alter table messages
  add column if not exists processed_for_memory boolean not null default false;

create index if not exists messages_memory_processing_idx
  on messages(group_id, processed_for_memory, created_at);
