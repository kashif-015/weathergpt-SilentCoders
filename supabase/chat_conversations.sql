-- Run this in the Supabase SQL Editor before enabling cloud chat history.
-- Firebase owns user authentication in this app, so user_id stores the
-- normalized Firebase account email rather than a Supabase Auth UUID.

create table if not exists public.chat_conversations (
  id text primary key,
  user_id text not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

-- Important: do not expose this table directly with permissive RLS in
-- production. Firebase tokens are not Supabase Auth tokens. Put a Supabase
-- Edge Function (or another backend) in front of this table that verifies the
-- Firebase ID token and only then performs these database operations.
