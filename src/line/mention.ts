export type LineMentionEvent = {
  mention?: {
    mentionees?: Array<{ isSelf?: boolean; userId?: string; displayName?: string }>;
  };
};

export function wasBotMentioned(event: LineMentionEvent): boolean {
  return Boolean(
    event.mention?.mentionees?.some((mention) => mention.isSelf === true)
  );
}

export function stripBotMention(text: string, event: LineMentionEvent): string {
  const mentionIds = event.mention?.mentionees ?? [];
  if (!mentionIds.length) return text;

  let cleaned = text;
  for (const mention of mentionIds) {
    if (mention.displayName) {
      cleaned = cleaned.replace(new RegExp(`@${mention.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), '').trim();
    }
  }

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}
