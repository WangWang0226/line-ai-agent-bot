import { searchGroupMemory } from '../../memory/memoryService';

export type SearchMemoryInput = {
  query: string;
  limit?: number;
};

export type SearchMemoryResult = {
  id: string;
  content: string;
  category: string;
  similarity: number;
  createdAt: string;
};

export async function searchMemory(groupId: string, input: SearchMemoryInput): Promise<SearchMemoryResult[]> {
  const memories = await searchGroupMemory(groupId, input.query, input.limit);
  return memories.map((memory) => ({
    id: memory.id,
    content: memory.content,
    category: memory.category,
    similarity: memory.similarity ?? 1,
    createdAt: memory.createdAt,
  }));
}
