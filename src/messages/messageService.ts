import { config } from '../config/env';
import { logger } from '../utils/logger';
import {
  deleteMessagesByIds,
  getMessageIdsOlderThan,
  getMessageIdsPastGroupLimit,
  getRecentMessages,
  insertMessage,
  upsertGroup,
  upsertUser,
} from './messageRepository';

const useLocalStore = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const localMessages = new Map<string, Array<{ userId: string; lineMessageId: string; content: string; createdAt: string }>>();
const seenMessageIds = new Set<string>();
const lastCleanupByGroup = new Map<string, number>();

export type StoredLineMessage = {
  groupDbId: string;
  userDbId: string;
  isDuplicate: boolean;
};

export async function storeLineMessage(input: {
  lineGroupId: string;
  lineUserId: string;
  lineMessageId: string;
  content: string;
}): Promise<StoredLineMessage> {
  if (useLocalStore) {
    const isDuplicate = seenMessageIds.has(input.lineMessageId);
    seenMessageIds.add(input.lineMessageId);
    if (!isDuplicate) {
      localMessages.set(input.lineGroupId, [
        ...(localMessages.get(input.lineGroupId) ?? []),
        {
          userId: input.lineUserId,
          lineMessageId: input.lineMessageId,
          content: input.content,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    return { groupDbId: input.lineGroupId, userDbId: input.lineUserId, isDuplicate };
  }

  const group = await upsertGroup(input.lineGroupId);
  const user = await upsertUser(input.lineUserId);
  const message = await insertMessage({
    groupId: group.id,
    userId: user.id,
    lineMessageId: input.lineMessageId,
    content: input.content,
  });

  return { groupDbId: group.id, userDbId: user.id, isDuplicate: !message };
}

export async function loadRecentGroupMessages(groupDbId: string): Promise<string[]> {
  if (useLocalStore) {
    return [...(localMessages.get(groupDbId) ?? [])]
      .slice(-config.recentMessageLimit)
      .map((message) => `User ${message.userId}: ${message.content}`);
  }

  const messages = await getRecentMessages(groupDbId, config.recentMessageLimit);
  return messages
    .reverse()
    .map((message) => `User ${message.users?.display_name ?? message.users?.line_user_id ?? 'unknown'}: ${message.content}`);
}

export async function cleanupRawMessageHistory(groupDbId: string, options: { force?: boolean } = {}): Promise<void> {
  const now = Date.now();
  const lastCleanup = lastCleanupByGroup.get(groupDbId) ?? 0;
  if (!options.force && now - lastCleanup < config.messageRetentionCleanupIntervalMs) {
    return;
  }
  lastCleanupByGroup.set(groupDbId, now);

  if (useLocalStore) {
    const cutoff = now - config.messageRetentionDays * 24 * 60 * 60 * 1000;
    const retainedByAge = (localMessages.get(groupDbId) ?? []).filter((message) => {
      return new Date(message.createdAt).getTime() >= cutoff;
    });
    localMessages.set(groupDbId, retainedByAge.slice(-config.messageRetentionMaxPerGroup));
    return;
  }

  const cutoffIso = new Date(now - config.messageRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;

  for (let batch = 0; batch < 20; batch += 1) {
    const oldIds = await getMessageIdsOlderThan(groupDbId, cutoffIso);
    if (oldIds.length === 0) break;
    await deleteMessagesByIds(oldIds);
    deleted += oldIds.length;
    if (oldIds.length < 1000) break;
  }

  for (let batch = 0; batch < 20; batch += 1) {
    const overflowIds = await getMessageIdsPastGroupLimit(groupDbId, config.messageRetentionMaxPerGroup);
    if (overflowIds.length === 0) break;
    await deleteMessagesByIds(overflowIds);
    deleted += overflowIds.length;
    if (overflowIds.length < 1000) break;
  }

  if (deleted > 0) {
    logger.info('cleaned up raw message history', {
      groupDbId,
      deleted,
      retentionDays: config.messageRetentionDays,
      maxPerGroup: config.messageRetentionMaxPerGroup,
    });
  }
}
