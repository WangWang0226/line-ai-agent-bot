import OpenAI from 'openai';
import { config } from '../config/env';
import { systemPrompt } from './systemPrompt';
import { executeToolCall, toolDefinitions } from './toolRegistry';
import { logger } from '../utils/logger';

const client = new OpenAI({
  apiKey: config.openAiApiKey,
});

export type AgentInput = {
  question: string;
  recentMessages: string[];
  memoryContext: string[];
  groupId: string;
  userId: string;
};

function getFunctionCalls(response: any) {
  return (response.output ?? []).filter((item: any) => item.type === 'function_call');
}

export async function generateAgentReply({ question, recentMessages, memoryContext, groupId, userId }: AgentInput): Promise<string> {
  let response = await client.responses.create({
    model: config.openAiModel,
    tools: [
      { type: 'web_search_preview' },
      ...toolDefinitions,
    ] as any,
    input: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nGroup ID: ${groupId}\n\nRelevant memories:\n${memoryContext.join('\n') || 'None'}\n\nRecent messages:\n${recentMessages.join('\n') || 'None'}`,
      },
      {
        role: 'user',
        content: question,
      },
    ],
  } as any);

  for (let iteration = 0; iteration < config.maxToolIterations; iteration += 1) {
    const calls = getFunctionCalls(response);
    if (!calls.length) break;

    const toolOutputs = [];
    for (const call of calls) {
      try {
        const output = await executeToolCall(call.name, call.arguments, { groupId, userId });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      } catch (error) {
        logger.error('tool call failed', {
          toolName: call.name,
          groupId,
          error: error instanceof Error ? error.message : String(error),
        });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ error: 'Tool execution failed.' }),
        });
      }
    }

    response = await client.responses.create({
      model: config.openAiModel,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: [
        { type: 'web_search_preview' },
        ...toolDefinitions,
      ] as any,
    } as any);
  }

  const message = response.output_text ?? 'I could not generate a response.';
  return message.trim();
}
