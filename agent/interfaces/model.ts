import type { JsonValue, ToolSpec } from './tool';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, JsonValue>;
}

export type CompletionChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'done' };

export interface ModelProvider {
  modelId: string;
  provider: 'anthropic' | 'openai' | 'google' | 'ollama' | string;
  complete(messages: ModelMessage[], tools: ToolSpec[]): AsyncIterable<CompletionChunk>;
}
