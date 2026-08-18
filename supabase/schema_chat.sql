-- ============================================================
-- Conversation history for the food agent. Run in Supabase SQL Editor,
-- after schema.sql and schema_food.sql.
-- Ported from jarvis-backend's Conversation/Message entities, which are
-- single-tenant (no user scoping at all). RLS here follows the same
-- per-user pattern as the rest of this project.
-- ============================================================

create type message_role_t as enum ('user', 'assistant');
create type message_provider_t as enum ('gemini', 'claude');

create table conversations (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  role            message_role_t not null,
  provider        message_provider_t,   -- only set on assistant messages
  content         text not null,
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation_created_at on messages(conversation_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table conversations enable row level security;
alter table messages      enable row level security;

create policy "own conversations" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on messages
  for all using (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );
