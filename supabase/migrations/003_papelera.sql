-- Papelera: los apuntes y temas borrados se guardan 30 días antes de borrarse del todo.
alter table public.notes add column if not exists deleted_at timestamptz;
alter table public.sections add column if not exists deleted_at timestamptz;
create index if not exists notes_trash_idx on public.notes (deleted_at) where deleted_at is not null;
create index if not exists sections_trash_idx on public.sections (deleted_at) where deleted_at is not null;

-- Las etiquetas de los apuntes de la papelera no se cuentan
create or replace function public.user_tags()
returns table (tag text, uses bigint)
language sql stable security invoker set search_path = public
as $$
  select t, count(*)
  from public.notes n
  join public.sections s on s.id = n.section_id
  , unnest(n.tags) as t
  where n.user_id = auth.uid() and n.deleted_at is null and s.deleted_at is null
  group by t
  order by t;
$$;
