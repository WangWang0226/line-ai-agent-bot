import { saveGroupMemory } from '../../memory/memoryService';
import type { MemoryCategory } from '../../types/memory';

export type SaveMemoryInput = {
  content: string;
  category?: MemoryCategory;
  importance?: number;
};

export async function saveMemory(groupId: string, createdBy: string, input: SaveMemoryInput) {
  return saveGroupMemory(groupId, createdBy, input);
}
