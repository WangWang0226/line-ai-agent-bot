import express, { type Express, type Request } from 'express';
import { handleLineWebhook } from './routes/lineWebhook';

export function createApp(): Express {
  const app = express();

  app.use(express.json({
    type: 'application/json',
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'line-shared-memory-ai-agent' });
  });

  app.post('/webhooks/line', handleLineWebhook);

  return app;
}
