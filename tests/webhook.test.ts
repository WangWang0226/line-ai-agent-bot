import { describe, expect, it, vi } from 'vitest';
import * as lineClient from '../src/line/client';
import { handleLineWebhook } from '../src/routes/lineWebhook';

vi.mock('../src/line/client', async () => {
  const actual = await vi.importActual<typeof import('../src/line/client')>('../src/line/client');
  return {
    ...actual,
    verifyLineSignature: vi.fn(() => true),
    replyToLine: vi.fn(async () => undefined),
  };
});

describe('webhook route', () => {
  function createMockResponse() {
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((body: unknown) => {
        res.body = body;
        return res;
      }),
    };
    return res;
  }

  it('rejects invalid LINE signature', async () => {
    vi.spyOn(lineClient, 'verifyLineSignature').mockReturnValueOnce(false);

    const req = {
      body: { events: [] },
      rawBody: '{"events":[]}',
      header: vi.fn(() => 'bad'),
    };
    const res = createMockResponse();
    await handleLineWebhook(req as any, res as any);

    expect(res.statusCode).toBe(401);
  });

  it('ignores unsupported events gracefully', async () => {
    const req = {
      body: {
        events: [
          {
            type: 'message',
            message: { type: 'image' },
            source: { type: 'group', groupId: 'g1' },
          },
        ],
      },
      rawBody: '{"events":[]}',
      header: vi.fn(() => 'abc'),
    };
    const res = createMockResponse();
    await handleLineWebhook(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
