import crypto from 'node:crypto';
import { createEmbedding } from './embeddingService';
import { deleteMemoryById, insertMemory, searchMemoriesByEmbedding, updateMemoryById } from './memoryRepository';
import type { MemoryCategory, MemoryRecord } from '../types/memory';

const inMemoryStore = new Map<string, MemoryRecord[]>();
const useLocalStore = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

function score(query: string, content: string) {
  const queryTerms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const contentTerms = new Set(content.toLowerCase().split(/\W+/).filter(Boolean));
  const overlap = [...queryTerms].filter((term) => contentTerms.has(term)).length;
  return queryTerms.size ? overlap / queryTerms.size : 0;
}

export async function saveGroupMemory(groupId: string, createdBy: string, input: {
  content: string;
  category?: MemoryCategory;
  importance?: number;
}): Promise<MemoryRecord> {
  const embedding = await createEmbedding(input.content);

  if (useLocalStore) {
    const now = new Date().toISOString();
    const memory: MemoryRecord = {
      id: crypto.randomUUID(),
      groupId,
      content: input.content,
      category: input.category ?? 'other',
      importance: input.importance ?? 0.5,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryStore.set(groupId, [...(inMemoryStore.get(groupId) ?? []), memory]);
    return memory;
  }

  return insertMemory({
    groupId,
    createdBy,
    content: input.content,
    category: input.category,
    importance: input.importance,
    embedding,
  });
}

export async function searchGroupMemory(groupId: string, query: string, limit = 5): Promise<MemoryRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 10);

  if (useLocalStore) {
    return [...(inMemoryStore.get(groupId) ?? [])]
      .map((memory) => ({ ...memory, similarity: score(query, memory.content) }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, safeLimit);
  }

  return searchMemoriesByEmbedding(groupId, await createEmbedding(query), safeLimit);
}

export async function updateGroupMemory(groupId: string, input: {
  id: string;
  content: string;
  category?: MemoryCategory;
  importance?: number;
}): Promise<MemoryRecord | null> {
  const embedding = await createEmbedding(input.content);

  if (useLocalStore) {
    const memories = inMemoryStore.get(groupId) ?? [];
    const index = memories.findIndex((memory) => memory.id === input.id);
    if (index === -1) return null;
    memories[index] = {
      ...memories[index],
      content: input.content,
      category: input.category ?? memories[index].category,
      importance: input.importance ?? memories[index].importance,
      updatedAt: new Date().toISOString(),
    };
    inMemoryStore.set(groupId, memories);
    return memories[index];
  }

  return updateMemoryById(groupId, input.id, {
    content: input.content,
    category: input.category,
    importance: input.importance,
    embedding,
  });
}

export async function deleteGroupMemory(groupId: string, id: string): Promise<{ id: string; deleted: boolean; deletedAt: string }> {
  if (useLocalStore) {
    inMemoryStore.set(groupId, (inMemoryStore.get(groupId) ?? []).filter((memory) => memory.id !== id));
  } else {
    await deleteMemoryById(groupId, id);
  }

  return { id, deleted: true, deletedAt: new Date().toISOString() };
}
