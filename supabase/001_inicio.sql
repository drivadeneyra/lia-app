-- LIA · Base de datos inicial
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo este archivo → Run.

-- 1) Datos de cada usuario (horario, evaluaciones, sesiones, ajustes)
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

drop policy if exists "leer mis datos" on public.user_data;
drop policy if exists "crear mis datos" on public.user_data;
drop policy if exists "actualizar mis datos" on public.user_data;
drop policy if exists "borrar mis datos" on public.user_data;
create policy "leer mis datos"       on public.user_data for select using ((select auth.uid()) = user_id);
create policy "crear mis datos"      on public.user_data for insert with check ((select auth.uid()) = user_id);
create policy "actualizar mis datos" on public.user_data for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar mis datos"     on public.user_data for delete using ((select auth.uid()) = user_id);

-- 2) Plan de cada usuario (gratis / pro). El usuario solo puede LEER su plan;
--    lo cambian ustedes desde el panel cuando alguien paga.
create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free','pro')),
  pro_until  date,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "ver mi plan" on public.subscriptions;
create policy "ver mi plan" on public.subscriptions for select using ((select auth.uid()) = user_id);

-- 3) Al crear una cuenta, se le asigna el plan gratis automáticamente
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
