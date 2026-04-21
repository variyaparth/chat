create extension if not exists pgcrypto;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message_id
  on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Users can read reactions" on public.message_reactions;
create policy "Users can read reactions"
  on public.message_reactions
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can insert own reactions" on public.message_reactions;
create policy "Users can insert own reactions"
  on public.message_reactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reactions" on public.message_reactions;
create policy "Users can delete own reactions"
  on public.message_reactions
  for delete
  using (auth.uid() = user_id);
