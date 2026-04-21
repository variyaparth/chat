create extension if not exists pgcrypto;

create table if not exists public.memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  character_id uuid references public.characters not null,
  memory_text text not null,
  category text default 'general',
  importance integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_memories_user_character
  on public.memories(user_id, character_id);

alter table public.memories enable row level security;

drop policy if exists "Users own memories" on public.memories;
create policy "Users own memories"
  on public.memories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
