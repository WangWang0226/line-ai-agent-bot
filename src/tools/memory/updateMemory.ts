import { updateGroupMemory } from '../../memory/memoryService';
import type { MemoryCategory } from '../../types/memory';

export type UpdateMemoryInput = {
  id: string;
  content: string;
  category?: MemoryCategory;
  importance?: number;
};

export async function updateMemory(groupId: string, input: UpdateMemoryInput) {
  return updateGroupMemory(groupId, input);
}
