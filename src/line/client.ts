import crypto from 'node:crypto';
import { config } from '../config/env';

export function verifyLineSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', config.lineChannelSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function splitLineText(message: string, maxLength = 4900): string[] {
  const normalized = message.replace(/\*\*/g, '').trim() || 'I could not generate a response.';
  if (normalized.length <= maxLength) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLength && chunks.length < 5) {
    const breakpoint = remaining.lastIndexOf('\n\n', maxLength);
    const splitAt = breakpoint > maxLength * 0.5 ? breakpoint : maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining.slice(0, maxLength).trim());
  return chunks;
}

export async function replyToLine(message: string, replyToken: string) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: splitLineText(message).map((text) => ({ type: 'text', text })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${text}`);
  }
}
