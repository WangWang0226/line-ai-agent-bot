import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config/env';
import { markMessagesProcessedForMemory, getUnprocessedMessagesForMemory } from '../messages/messageRepository';
import { saveGroupMemory, searchGroupMemory } from './memoryService';
import { logger } from '../utils/logger';
import type { MemoryCategory } from '../types/memory';

const client = new OpenAI({ apiKey: config.openAiApiKey });
const useLocalExtractor = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const extractionLocks = new Set<string>();

const candidateSchema = z.object({
  memories: z.array(z.object({
    content: z.string().min(1),
    category: z.enum(['decision', 'plan', 'recommendation', 'preference', 'fact', 'resource', 'event', 'other']).default('other'),
    importance: z.number().min(0).max(1).default(0.6),
    sourceMessageIndexes: z.array(z.number().int().min(0)).default([]),
  })).default([]),
});

type ExtractionMessage = {
  id: string;
  userId: string;
  userLabel: string;
  content: string;
  createdAt: string;
};

function formatMessages(messages: ExtractionMessage[]) {
  return messages.map((message, index) => {
    return `[${index}] ${message.createdAt} ${message.userLabel}: ${message.content}`;
  }).join('\n');
}

function parseJsonObject(text: string) {
  const withoutFence = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return { memories: [] };
  }
  return JSON.parse(withoutFence.slice(start, end + 1));
}

async function extractCandidates(messages: ExtractionMessage[]) {
  if (useLocalExtractor) {
    const text = messages.map((message) => message.content).join(' ');
    if (!/\b(agreed|decided|remember|plan|deadline|trip)\b/i.test(text)) {
      return [];
    }
    return [{
      content: text.slice(0, 240),
      category: 'other' as MemoryCategory,
      importance: 0.7,
      sourceMessageIndexes: messages.map((_message, index) => index),
    }];
  }

  const response = await client.responses.create({
    model: config.extractionModel,
    input: [
      {
        role: 'system',
        content: [
          'You extract durable shared group memories from LINE chat batches.',
          'Return only JSON matching this shape: {"memories":[{"content":"...","category":"plan","importance":0.8,"sourceMessageIndexes":[0,1]}]}.',
          'Extract decisions, plans, recommendations, stable preferences, important facts, resources, and events.',
          'Do not extract greetings, jokes, small talk, transient emotions, duplicates, or vague context.',
          'Write memories as standalone facts that can be understood later.',
          'Use sourceMessageIndexes from the provided numbered messages.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: formatMessages(messages),
      },
    ],
  });

  const raw = response.output_text?.trim() || '{"memories":[]}';
  const parsed = candidateSchema.safeParse(parseJsonObject(raw));
  if (!parsed.success) {
    logger.warn('memory extraction returned invalid schema', {
      error: parsed.error.message,
    });
    return [];
  }
  return parsed.data.memories;
}

export async function runAutomaticMemoryExtraction(groupId: string): Promise<{ processed: number; saved: number; skipped: number }> {
  if (!config.memoryExtractionEnabled) {
    return { processed: 0, saved: 0, skipped: 0 };
  }

  if (extractionLocks.has(groupId)) {
    return { processed: 0, saved: 0, skipped: 0 };
  }
  extractionLocks.add(groupId);

  try {
    const rows = await getUnprocessedMessagesForMemory(groupId, config.memoryExtractionBatchSize);
    if (rows.length < config.memoryExtractionMinMessages) {
      return { processed: 0, saved: 0, skipped: 0 };
    }

    const messages = rows.map((row) => ({
      id: row.id,
      userId: row.user_id ?? '',
      userLabel: row.users?.display_name ?? row.users?.line_user_id ?? row.user_id ?? 'unknown',
      content: row.content,
      createdAt: row.created_at,
    }));

    const candidates = await extractCandidates(messages);
    let saved = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const existing = await searchGroupMemory(groupId, candidate.content, 1);
      const bestSimilarity = existing[0]?.similarity ?? 0;
      if (bestSimilarity >= config.memoryExtractionDedupeThreshold) {
        skipped += 1;
        continue;
      }

      const sourceMessageIds = candidate.sourceMessageIndexes
        .map((index) => messages[index]?.id)
        .filter((id): id is string => Boolean(id));
      const createdBy = messages[candidate.sourceMessageIndexes[0] ?? 0]?.userId || messages[0]?.userId || '';

      await saveGroupMemory(groupId, createdBy, {
        content: candidate.content,
        category: candidate.category,
        importance: candidate.importance,
        sourceMessageIds,
      });
      saved += 1;
    }

    await markMessagesProcessedForMemory(rows.map((row) => row.id));

    logger.info('automatic memory extraction completed', {
      groupId,
      processed: rows.length,
      candidates: candidates.length,
      saved,
      skipped,
    });

    return { processed: rows.length, saved, skipped };
  } catch (error) {
    logger.error('automatic memory extraction failed', {
      groupId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { processed: 0, saved: 0, skipped: 0 };
  } finally {
    extractionLocks.delete(groupId);
  }
}
