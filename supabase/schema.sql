-- Rode no SQL Editor do Supabase. Cada usuário só vê os próprios dados.
create table if not exists public.folders (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.links (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists links_user_idx on public.links (user_id);
create index if not exists folders_user_idx on public.folders (user_id);

alter table public.folders enable row level security;
alter table public.links enable row level security;

create policy "folders do dono" on public.folders for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "links do dono" on public.links for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tempo real
alter publication supabase_realtime add table public.folders, public.links;

-- Bucket público para as imagens de preview (a função /api/preview grava com a service key)
insert into storage.buckets (id, name, public) values ('previews', 'previews', true) on conflict (id) do nothing;
