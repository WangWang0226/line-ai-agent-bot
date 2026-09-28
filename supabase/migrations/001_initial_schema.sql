create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  line_group_id text unique not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  line_message_id text unique not null,
  content text not null,
  processed_for_memory boolean not null default false,
  created_at timestamptz not null default now()
);

-- Raw message retention is enforced by the application:
-- keep messages for MESSAGE_RETENTION_DAYS and cap each group at
-- MESSAGE_RETENTION_MAX_PER_GROUP rows. Long-term memories are stored
-- separately in memories and are not deleted by raw history cleanup.

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  content text not null,
  summary text,
  category text not null default 'other',
  importance double precision not null default 0.5,
  embedding vector(1536) not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memory_sources (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade
);

create index if not exists messages_group_id_idx on messages(group_id);
create index if not exists messages_user_id_idx on messages(user_id);
create index if not exists messages_created_at_idx on messages(created_at desc);
create index if not exists messages_line_message_id_idx on messages(line_message_id);
create index if not exists messages_memory_processing_idx on messages(group_id, processed_for_memory, created_at);

create index if not exists memories_group_id_idx on memories(group_id);
create index if not exists memories_created_at_idx on memories(created_at desc);
create index if not exists memories_embedding_idx on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_memories(
  query_embedding vector(1536),
  match_group_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  group_id uuid,
  content text,
  summary text,
  category text,
  importance double precision,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    memories.id,
    memories.group_id,
    memories.content,
    memories.summary,
    memories.category,
    memories.importance,
    memories.created_by,
    memories.created_at,
    memories.updated_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where memories.group_id = match_group_id
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;
