import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { CompletionChunk, ModelMessage, ModelProvider, ToolCall } from '../interfaces/model';
import type { JsonValue, ToolSpec } from '../interfaces/tool';

export interface OpenAIModelProviderOptions {
  apiKey?: string;
  baseURL?: string;
  modelId?: string;
  provider?: 'openai' | 'ollama' | string;
  client?: OpenAI;
}

export class OpenAIModelProvider implements ModelProvider {
  readonly modelId: string;
  readonly provider: 'openai' | 'ollama' | string;
  private readonly client: OpenAI;

  constructor(options: OpenAIModelProviderOptions = {}) {
    const baseURL = options.baseURL ?? process.env.OPENAI_BASE_URL;
    this.modelId = options.modelId ?? process.env.OPENAI_MODEL ?? (baseURL?.includes('11434') ? 'llama3.1' : 'gpt-4.1-mini');
    this.provider = options.provider ?? (baseURL?.includes('11434') ? 'ollama' : 'openai');
    this.client = options.client ?? new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY ?? (this.provider === 'ollama' ? 'ollama' : undefined),
      baseURL,
    });
  }

  async *complete(messages: ModelMessage[], tools: ToolSpec[]): AsyncIterable<CompletionChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.modelId,
      messages: messages.map(toOpenAIMessage),
      tools: tools.map(toOpenAITool),
      stream: true,
    });

    const toolCalls = new Map<number, ToolCall & { rawArgs: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) yield { type: 'text_delta', text: delta.content };

      for (const toolCallDelta of delta.tool_calls ?? []) {
        const index = toolCallDelta.index;
        const current = toolCalls.get(index) ?? {
          id: toolCallDelta.id ?? `tool-${index}`,
          name: toolCallDelta.function?.name ?? '',
          args: {},
          rawArgs: '',
        };

        if (toolCallDelta.id) current.id = toolCallDelta.id;
        if (toolCallDelta.function?.name) current.name = toolCallDelta.function.name;
        if (toolCallDelta.function?.arguments) {
          current.rawArgs += toolCallDelta.function.arguments;
          current.args = parseToolArgs(current.rawArgs);
        }

        toolCalls.set(index, current);
      }
    }

    for (const toolCall of toolCalls.values()) {
      if (toolCall.name) yield { type: 'tool_call', toolCall };
    }

    yield { type: 'done' };
  }
}

function toOpenAIMessage(message: ModelMessage): ChatCompletionMessageParam {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId ?? 'tool' };
  }

  return { role: message.role, content: message.content };
}

function toOpenAITool(tool: ToolSpec): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  };
}

function parseToolArgs(raw: string): Record<string, JsonValue> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, JsonValue>;
  } catch {}
  return {};
}
