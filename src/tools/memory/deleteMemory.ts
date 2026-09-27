import { deleteGroupMemory } from '../../memory/memoryService';

export async function deleteMemory(groupId: string, memoryId: string) {
  return deleteGroupMemory(groupId, memoryId);
}
