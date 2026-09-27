import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const testDefaults = {
  OPENAI_API_KEY: 'test-openai-key',
  LINE_CHANNEL_SECRET: 'test-line-secret',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-line-access-token',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-supabase-key',
};

const envSource = {
  ...process.env,
  ...Object.fromEntries(
    Object.entries(testDefaults).filter(([key, value]) => isTestMode && !process.env[key])
      .map(([key, value]) => [key, value])
  ),
};

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  LINE_CHANNEL_SECRET: z.string().min(1, 'LINE_CHANNEL_SECRET is required'),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1, 'LINE_CHANNEL_ACCESS_TOKEN is required'),
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  RECENT_MESSAGE_LIMIT: z.coerce.number().default(30),
  MESSAGE_RETENTION_DAYS: z.coerce.number().default(90),
  MESSAGE_RETENTION_MAX_PER_GROUP: z.coerce.number().default(10000),
  MESSAGE_RETENTION_CLEANUP_INTERVAL_MS: z.coerce.number().default(3600000),
  MAX_TOOL_ITERATIONS: z.coerce.number().default(5),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(envSource);

export const config = {
  port: env.PORT,
  openAiApiKey: env.OPENAI_API_KEY,
  openAiModel: env.OPENAI_MODEL,
  embeddingModel: env.OPENAI_EMBEDDING_MODEL,
  embeddingDimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
  lineChannelSecret: env.LINE_CHANNEL_SECRET,
  lineChannelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  recentMessageLimit: env.RECENT_MESSAGE_LIMIT,
  messageRetentionDays: env.MESSAGE_RETENTION_DAYS,
  messageRetentionMaxPerGroup: env.MESSAGE_RETENTION_MAX_PER_GROUP,
  messageRetentionCleanupIntervalMs: env.MESSAGE_RETENTION_CLEANUP_INTERVAL_MS,
  maxToolIterations: env.MAX_TOOL_ITERATIONS,
};
