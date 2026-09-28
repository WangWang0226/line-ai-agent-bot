import { supabaseDelete, supabaseInsert, supabasePatch, supabaseRpc } from '../db/supabase';
import type { MemoryCategory, MemoryRecord } from '../types/memory';

type DbMemory = {
  id: string;
  group_id: string;
  content: string;
  summary: string | null;
  category: MemoryCategory | null;
  importance: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  similarity?: number;
};

function toMemory(row: DbMemory): MemoryRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    content: row.content,
    summary: row.summary,
    category: row.category ?? 'other',
    importance: row.importance ?? 0.5,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    similarity: row.similarity,
  };
}

export type SaveMemoryData = {
  groupId: string;
  content: string;
  embedding: number[];
  createdBy?: string;
  category?: MemoryCategory;
  importance?: number;
  summary?: string;
  sourceMessageIds?: string[];
};

export async function insertMemory(data: SaveMemoryData): Promise<MemoryRecord> {
  const [row] = await supabaseInsert<DbMemory>('memories', {
    group_id: data.groupId,
    content: data.content,
    summary: data.summary ?? null,
    category: data.category ?? 'other',
    importance: data.importance ?? 0.5,
    embedding: data.embedding,
    created_by: data.createdBy ?? null,
  });
  if (data.sourceMessageIds?.length) {
    await supabaseInsert('memory_sources', data.sourceMessageIds.map((messageId) => ({
      memory_id: row.id,
      message_id: messageId,
    })));
  }
  return toMemory(row);
}

export async function searchMemoriesByEmbedding(groupId: string, embedding: number[], limit: number): Promise<MemoryRecord[]> {
  const rows = await supabaseRpc<DbMemory[]>('match_memories', {
    query_embedding: embedding,
    match_group_id: groupId,
    match_count: limit,
  });
  return rows.map(toMemory);
}

export async function updateMemoryById(groupId: string, id: string, data: {
  content: string;
  embedding: number[];
  category?: MemoryCategory;
  importance?: number;
}): Promise<MemoryRecord | null> {
  const rows = await supabasePatch<DbMemory>('memories', { id: `eq.${id}`, group_id: `eq.${groupId}` }, {
    content: data.content,
    embedding: data.embedding,
    category: data.category ?? 'other',
    importance: data.importance ?? 0.5,
    updated_at: new Date().toISOString(),
  });
  return rows[0] ? toMemory(rows[0]) : null;
}

export async function deleteMemoryById(groupId: string, id: string): Promise<void> {
  await supabaseDelete('memories', { id: `eq.${id}`, group_id: `eq.${groupId}` });
}
