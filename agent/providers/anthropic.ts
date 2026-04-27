import Anthropic from '@anthropic-ai/sdk';
import type { CompletionChunk, ModelMessage, ModelProvider, ToolCall } from '../interfaces/model';
import type { ToolSpec } from '../interfaces/tool';

export interface AnthropicModelProviderOptions {
  apiKey?: string;
  modelId?: string;
  client?: Anthropic;
}

export class AnthropicModelProvider implements ModelProvider {
  readonly modelId: string;
  readonly provider = 'anthropic';
  private readonly client: Anthropic;

  constructor(options: AnthropicModelProviderOptions = {}) {
    this.modelId = options.modelId ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async *complete(messages: ModelMessage[], tools: ToolSpec[]): AsyncIterable<CompletionChunk> {
    const stream = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n') || undefined,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
      })),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text_delta', text: event.delta.text };
      }

      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        yield {
          type: 'tool_call',
          toolCall: {
            id: event.content_block.id,
            name: event.content_block.name,
            args: normalizeToolArgs(event.content_block.input),
          },
        };
      }
    }

    yield { type: 'done' };
  }
}

function normalizeToolArgs(input: unknown): ToolCall['args'] {
  if (input != null && typeof input === 'object' && !Array.isArray(input)) {
    return input as ToolCall['args'];
  }
  return {};
}
