import { z } from 'zod';
import { deleteMemory, saveMemory, searchMemory, updateMemory } from '../tools';

const categorySchema = z.enum(['decision', 'plan', 'recommendation', 'preference', 'fact', 'resource', 'event', 'other']);

export type ToolRuntimeContext = {
  groupId: string;
  userId: string;
};

export const toolDefinitions = [
  {
    type: 'function',
    name: 'search_memory',
    description: 'Search long-term shared memories for the current LINE group.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 10 },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'save_memory',
    description: 'Save important information into long-term shared memory for the current LINE group.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        category: { type: 'string', enum: categorySchema.options },
        importance: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['content'],
    },
  },
  {
    type: 'function',
    name: 'update_memory',
    description: 'Update an existing memory in the current LINE group.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        category: { type: 'string', enum: categorySchema.options },
        importance: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['id', 'content'],
    },
  },
  {
    type: 'function',
    name: 'delete_memory',
    description: 'Delete an existing memory from the current LINE group.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
] as const;

export async function executeToolCall(name: string, rawArguments: string, context: ToolRuntimeContext) {
  const args = JSON.parse(rawArguments || '{}');

  if (name === 'search_memory') {
    return searchMemory(context.groupId, z.object({
      query: z.string().min(1),
      limit: z.number().optional(),
    }).parse(args));
  }

  if (name === 'save_memory') {
    return saveMemory(context.groupId, context.userId, z.object({
      content: z.string().min(1),
      category: categorySchema.optional(),
      importance: z.number().min(0).max(1).optional(),
    }).parse(args));
  }

  if (name === 'update_memory') {
    return updateMemory(context.groupId, z.object({
      id: z.string().min(1),
      content: z.string().min(1),
      category: categorySchema.optional(),
      importance: z.number().min(0).max(1).optional(),
    }).parse(args));
  }

  if (name === 'delete_memory') {
    const parsed = z.object({ id: z.string().min(1) }).parse(args);
    return deleteMemory(context.groupId, parsed.id);
  }

  throw new Error(`Unknown tool: ${name}`);
}
