create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  title text,
  last_message text,
  last_message_at timestamptz,
  message_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  user_id uuid,
  character_id uuid,
  role text,
  content text,
  created_at timestamptz default now()
);

alter table public.messages
  alter column conversation_id set not null,
  alter column user_id set not null,
  alter column character_id set not null,
  alter column role set not null,
  alter column content set not null,
  alter column created_at set not null;

alter table public.messages
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_conversation_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_conversation_id_fkey
      foreign key (conversation_id)
      references public.conversations(id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_user_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_character_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_character_id_fkey
      foreign key (character_id)
      references public.characters(id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_role_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_role_check
      check (role in ('user', 'assistant'));
  end if;
end
$$;

create index if not exists idx_messages_conversation_id
  on public.messages (conversation_id);

create index if not exists idx_conversations_user_last_message_at
  on public.conversations (user_id, last_message_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can read own conversations" on public.conversations;
create policy "Users can read own conversations"
  on public.conversations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own conversations" on public.conversations;
create policy "Users can insert own conversations"
  on public.conversations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own messages" on public.messages;
create policy "Users can read own messages"
  on public.messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.messages;
create policy "Users can insert own messages"
  on public.messages
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

create or replace function public.update_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    title = coalesce(title, left(new.content, 80)),
    last_message = left(new.content, 160),
    last_message_at = new.created_at,
    message_count = coalesce(message_count, 0) + 1
  where id = new.conversation_id
    and user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_message_insert_update_conversation on public.messages;
create trigger on_message_insert_update_conversation
after insert on public.messages
for each row
execute function public.update_conversation_from_message();

create or replace function public.get_conversation_with_messages(p_conversation_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'conversation',
    jsonb_build_object(
      'id', conv.id,
      'user_id', conv.user_id,
      'character_id', conv.character_id,
      'title', conv.title,
      'last_message', conv.last_message,
      'last_message_at', conv.last_message_at,
      'message_count', conv.message_count,
      'created_at', conv.created_at,
      'character_name', ch.name,
      'avatar_emoji', ch.avatar_emoji
    ),
    'messages',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'conversation_id', m.conversation_id,
            'user_id', m.user_id,
            'character_id', m.character_id,
            'role', m.role,
            'content', m.content,
            'created_at', m.created_at
          )
          order by m.created_at asc
        )
        from public.messages m
        where m.conversation_id = conv.id
          and m.user_id = auth.uid()
      ),
      '[]'::jsonb
    )
  )
  from public.conversations conv
  join public.characters ch on ch.id = conv.character_id
  where conv.id = p_conversation_id
    and conv.user_id = auth.uid();
$$;

grant execute on function public.get_conversation_with_messages(uuid) to authenticated;
