-- Cuadernos DAW · esquema inicial
-- Ejecutar una vez en Supabase: Dashboard → SQL Editor → New query → pegar → Run.
-- Los 7 cuadernos son fijos y viven en el código (src/data/notebooks.ts);
-- aquí se guardan los temas (sections) y los apuntes (notes) de cada usuario.

create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  notebook    text not null check (notebook in ('si', 'pro', 'ed', 'bd', 'lmsgi', 'ing', 'pi')),
  title       text not null default 'Nuevo tema',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  section_id    uuid not null references public.sections on delete cascade,
  title         text not null default '',
  content       jsonb,
  content_text  text not null default '',
  pinned        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  fts           tsvector generated always as (
                  to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content_text, ''))
                ) stored
);

create index if not exists sections_user_notebook_idx on public.sections (user_id, notebook, position);
create index if not exists notes_section_idx on public.notes (section_id, updated_at desc);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_fts_idx on public.notes using gin (fts);

-- updated_at automático
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- Seguridad: cada usuario solo ve y modifica sus filas
alter table public.sections enable row level security;
alter table public.notes enable row level security;

drop policy if exists "sections_own" on public.sections;
create policy "sections_own" on public.sections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notes_own" on public.notes;
create policy "notes_own" on public.notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.sections s where s.id = section_id and s.user_id = auth.uid())
  );
