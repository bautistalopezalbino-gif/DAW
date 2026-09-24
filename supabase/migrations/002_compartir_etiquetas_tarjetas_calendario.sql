-- Cuadernos DAW · compartir cuadernos, edición en tiempo real, etiquetas,
-- tarjetas de repaso, calendario y archivos adjuntos.
-- Ejecutar una vez en Supabase: SQL Editor → New query → pegar → Run.
-- Se puede ejecutar varias veces sin problema.

-- =====================================================================
-- 1. Compartir cuadernos
-- =====================================================================
create table if not exists public.notebook_shares (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users on delete cascade,
  owner_email  text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  notebook     text not null check (notebook in ('si', 'pro', 'ed', 'bd', 'lmsgi', 'ing', 'pi')),
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  role         text not null default 'editor' check (role in ('editor', 'lector')),
  created_at   timestamptz not null default now(),
  unique (owner_id, notebook, email)
);
create index if not exists notebook_shares_email_idx on public.notebook_shares (email);

alter table public.notebook_shares enable row level security;

drop policy if exists "shares_owner" on public.notebook_shares;
create policy "shares_owner" on public.notebook_shares
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Quien recibe la invitación puede verla y también salir del cuaderno
drop policy if exists "shares_member_read" on public.notebook_shares;
create policy "shares_member_read" on public.notebook_shares
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "shares_member_leave" on public.notebook_shares;
create policy "shares_member_leave" on public.notebook_shares
  for delete to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- El email del propietario siempre es el de la sesión (no se puede falsear)
create or replace function public.shares_set_owner_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.owner_email := lower(coalesce(auth.jwt() ->> 'email', new.owner_email));
  return new;
end;
$$;

drop trigger if exists shares_set_owner_email on public.notebook_shares;
create trigger shares_set_owner_email before insert on public.notebook_shares
  for each row execute function public.shares_set_owner_email();

-- Rol del usuario actual en el cuaderno <nb> de <owner>: 'owner', 'editor', 'lector' o null
create or replace function public.notebook_role(p_owner uuid, p_notebook text)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when p_owner = auth.uid() then 'owner'
    else (
      select s.role from public.notebook_shares s
      where s.owner_id = p_owner
        and s.notebook = p_notebook
        and s.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      limit 1
    )
  end;
$$;

create or replace function public.note_role(p_section uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select public.notebook_role(s.user_id, s.notebook) from public.sections s where s.id = p_section;
$$;

create or replace function public.note_role_by_id(p_note uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select public.note_role(n.section_id) from public.notes n where n.id = p_note;
$$;

-- Los apuntes siempre pertenecen al dueño del cuaderno, aunque los cree un colaborador
create or replace function public.notes_set_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.user_id := (select user_id from public.sections where id = new.section_id);
  return new;
end;
$$;

drop trigger if exists notes_set_owner on public.notes;
create trigger notes_set_owner before insert or update of section_id on public.notes
  for each row execute function public.notes_set_owner();

-- Un tema no puede cambiar de propietario (un colaborador no puede "quedárselo")
create or replace function public.sections_keep_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar el propietario de un tema';
  end if;
  return new;
end;
$$;

drop trigger if exists sections_keep_owner on public.sections;
create trigger sections_keep_owner before update of user_id on public.sections
  for each row execute function public.sections_keep_owner();

-- Nuevas políticas de temas y apuntes (sustituyen a las de la migración 001)
drop policy if exists "sections_own" on public.sections;
drop policy if exists "sections_read" on public.sections;
drop policy if exists "sections_insert" on public.sections;
drop policy if exists "sections_update" on public.sections;
drop policy if exists "sections_delete" on public.sections;

create policy "sections_read" on public.sections
  for select to authenticated
  using (public.notebook_role(user_id, notebook) is not null);
create policy "sections_insert" on public.sections
  for insert to authenticated
  with check (public.notebook_role(user_id, notebook) in ('owner', 'editor'));
create policy "sections_update" on public.sections
  for update to authenticated
  using (public.notebook_role(user_id, notebook) in ('owner', 'editor'))
  with check (public.notebook_role(user_id, notebook) in ('owner', 'editor'));
create policy "sections_delete" on public.sections
  for delete to authenticated
  using (public.notebook_role(user_id, notebook) in ('owner', 'editor'));

drop policy if exists "notes_own" on public.notes;
drop policy if exists "notes_read" on public.notes;
drop policy if exists "notes_insert" on public.notes;
drop policy if exists "notes_update" on public.notes;
drop policy if exists "notes_delete" on public.notes;

create policy "notes_read" on public.notes
  for select to authenticated
  using (public.note_role(section_id) is not null);
create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (public.note_role(section_id) in ('owner', 'editor'));
create policy "notes_update" on public.notes
  for update to authenticated
  using (public.note_role(section_id) in ('owner', 'editor'))
  with check (public.note_role(section_id) in ('owner', 'editor'));
create policy "notes_delete" on public.notes
  for delete to authenticated
  using (public.note_role(section_id) in ('owner', 'editor'));

-- Estado del documento colaborativo (Yjs, base64)
alter table public.notes add column if not exists ydoc text;

-- =====================================================================
-- 2. Etiquetas
-- =====================================================================
alter table public.notes add column if not exists tags text[] not null default '{}';
create index if not exists notes_tags_idx on public.notes using gin (tags);

create or replace function public.user_tags()
returns table (tag text, uses bigint)
language sql stable security invoker set search_path = public
as $$
  select t, count(*)
  from public.notes, unnest(tags) as t
  where user_id = auth.uid()
  group by t
  order by t;
$$;

-- =====================================================================
-- 3. Tarjetas de repaso (sistema Leitner) — personales
-- =====================================================================
create table if not exists public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  notebook    text not null check (notebook in ('si', 'pro', 'ed', 'bd', 'lmsgi', 'ing', 'pi')),
  note_id     uuid references public.notes on delete set null,
  front       text not null,
  back        text not null default '',
  box         smallint not null default 0,
  due_at      timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists flashcards_user_due_idx on public.flashcards (user_id, due_at);

alter table public.flashcards enable row level security;
drop policy if exists "flashcards_own" on public.flashcards;
create policy "flashcards_own" on public.flashcards
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- 4. Calendario de exámenes y entregas — personal
-- =====================================================================
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  notebook    text check (notebook is null or notebook in ('si', 'pro', 'ed', 'bd', 'lmsgi', 'ing', 'pi')),
  title       text not null,
  kind        text not null default 'examen' check (kind in ('examen', 'entrega', 'otro')),
  date        date not null,
  details     text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists events_user_date_idx on public.events (user_id, date);

alter table public.events enable row level security;
drop policy if exists "events_own" on public.events;
create policy "events_own" on public.events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- 5. Archivos adjuntos (imágenes, PDF…)
-- Ruta: <owner_id>/<cuaderno>/<note_id>/<archivo>; acceso según el rol en el cuaderno
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create or replace function public.storage_role(p_name text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
begin
  if coalesce(array_length(parts, 1), 0) < 2
     or parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return public.notebook_role(parts[1]::uuid, parts[2]);
end;
$$;

drop policy if exists "attachments_select" on storage.objects;
create policy "attachments_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and public.storage_role(name) is not null);

drop policy if exists "attachments_insert" on storage.objects;
create policy "attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.storage_role(name) in ('owner', 'editor'));

drop policy if exists "attachments_update" on storage.objects;
create policy "attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and public.storage_role(name) in ('owner', 'editor'));

drop policy if exists "attachments_delete" on storage.objects;
create policy "attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and public.storage_role(name) in ('owner', 'editor'));

-- =====================================================================
-- 6. Canales en tiempo real privados por apunte ("note:<id>")
-- Solo quien puede ver el apunte recibe los cambios; solo editores los envían.
-- =====================================================================
create or replace function public.note_role_by_topic(p_topic text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  id_text text := substring(p_topic from '^note:([0-9a-f-]{36})$');
begin
  if id_text is null then
    return null;
  end if;
  return public.note_role_by_id(id_text::uuid);
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "note_channels_read" on realtime.messages';
    execute $p$
      create policy "note_channels_read" on realtime.messages
        for select to authenticated
        using (public.note_role_by_topic(realtime.topic()) is not null)
    $p$;
    execute 'drop policy if exists "note_channels_write" on realtime.messages';
    execute $p$
      create policy "note_channels_write" on realtime.messages
        for insert to authenticated
        with check (public.note_role_by_topic(realtime.topic()) in ('owner', 'editor'))
    $p$;
  end if;
end;
$$;
