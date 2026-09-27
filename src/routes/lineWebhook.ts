import type { Request, Response } from 'express';
import { verifyLineSignature, replyToLine } from '../line/client';
import { wasBotMentioned, stripBotMention } from '../line/mention';
import { generateAgentReply } from '../agent/agent';
import type { LineEvent, LineWebhookBody } from '../types/line';
import { cleanupRawMessageHistory, loadRecentGroupMessages, storeLineMessage } from '../messages/messageService';
import { searchMemory } from '../tools/memory/searchMemory';
import { logger } from '../utils/logger';

function getLineGroupId(event: LineEvent): string | null {
  return event.source?.groupId ?? null;
}

function getLineUserId(event: LineEvent): string | null {
  return event.source?.userId ?? null;
}

function extractTextFromEvent(event: LineEvent): string {
  return String(event.message?.text ?? '');
}

export async function handleLineWebhook(req: Request & { rawBody?: string }, res: Response) {
  const signature = req.header('x-line-signature');
  const rawBody = req.rawBody ?? JSON.stringify(req.body);

  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  const body = req.body as LineWebhookBody;
  const events = Array.isArray(body?.events) ? body.events : [];

  for (const event of events) {
    try {
      if (event.type !== 'message' || event.message?.type !== 'text' || event.source?.type !== 'group') {
        continue;
      }

      const groupId = getLineGroupId(event);
      const userId = getLineUserId(event);
      const lineMessageId = event.message?.id;
      if (!groupId || !userId || !lineMessageId) {
        logger.warn('missing required LINE identifiers', { eventType: event.type });
        continue;
      }

      const rawText = extractTextFromEvent(event);
      const stored = await storeLineMessage({
        lineGroupId: groupId,
        lineUserId: userId,
        lineMessageId,
        content: rawText,
      });

      if (stored.isDuplicate) {
        logger.info('duplicate LINE message ignored', { groupId, lineMessageId });
        continue;
      }

      cleanupRawMessageHistory(stored.groupDbId).catch((error) => {
        logger.error('raw message cleanup failed', {
          groupId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      const mentionActive = wasBotMentioned(event.message);

      if (!mentionActive) {
        continue;
      }

      const cleanQuestion = stripBotMention(rawText, event.message);
      const recentMessages = await loadRecentGroupMessages(stored.groupDbId);
      const memoryContext = (await searchMemory(stored.groupDbId, {
        query: cleanQuestion || rawText,
        limit: 5,
      })).map((memory) => `${memory.category}: ${memory.content}`);

      const replyText = await generateAgentReply({
        question: cleanQuestion || 'Hello',
        recentMessages,
        memoryContext,
        groupId: stored.groupDbId,
        userId: stored.userDbId,
      });

      if (event.replyToken) {
        await replyToLine(replyText, event.replyToken);
      }
    } catch (error) {
      logger.error('failed to process LINE event', {
        error: error instanceof Error ? error.message : String(error),
        replyToken: event.replyToken,
      });
    }
  }

  return res.status(200).json({ ok: true });
}

export default handleLineWebhook;
