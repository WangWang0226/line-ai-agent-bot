import { describe, expect, it } from 'vitest';
import { cleanupRawMessageHistory, loadRecentGroupMessages, storeLineMessage } from '../src/messages/messageService';

describe('message retention', () => {
  it('keeps raw messages bounded per group without touching memory storage', async () => {
    for (let index = 0; index < 10005; index += 1) {
      await storeLineMessage({
        lineGroupId: 'retention-group',
        lineUserId: 'user-a',
        lineMessageId: `message-${index}`,
        content: `message ${index}`,
      });
    }

    await cleanupRawMessageHistory('retention-group', { force: true });

    const recentMessages = await loadRecentGroupMessages('retention-group');
    expect(recentMessages).toHaveLength(30);
    expect(recentMessages[0]).toContain('message 9975');
    expect(recentMessages[29]).toContain('message 10004');
  });
});
