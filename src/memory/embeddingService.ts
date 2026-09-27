import OpenAI from 'openai';
import { config } from '../config/env';

const client = new OpenAI({ apiKey: config.openAiApiKey });

export async function createEmbedding(input: string): Promise<number[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return Array.from({ length: config.embeddingDimensions }, (_, index) => {
      const code = input.charCodeAt(index % Math.max(input.length, 1)) || 0;
      return (code % 31) / 31;
    });
  }

  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input,
  });

  return response.data[0]?.embedding ?? [];
}
