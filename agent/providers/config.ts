import type { ModelProvider } from '../interfaces/model';
import { AnthropicModelProvider } from './anthropic';
import { OpenAIModelProvider } from './openai';

export type ModelProviderName = 'anthropic' | 'openai' | 'ollama' | string;

export interface ModelProviderConfig {
  provider: ModelProviderName;
  modelId?: string;
  apiKey?: string;
  baseURL?: string;
}

export function modelProviderConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig {
  const provider = env.CLAWFACE_MODEL_PROVIDER ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
  return {
    provider,
    modelId: env.CLAWFACE_MODEL_ID ?? env.ANTHROPIC_MODEL ?? env.OPENAI_MODEL,
    apiKey: provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  };
}

export function createModelProvider(config: ModelProviderConfig = modelProviderConfigFromEnv()): ModelProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicModelProvider({ apiKey: config.apiKey, modelId: config.modelId });
    case 'ollama':
      return new OpenAIModelProvider({
        apiKey: config.apiKey ?? 'ollama',
        baseURL: config.baseURL ?? 'http://127.0.0.1:11434/v1',
        modelId: config.modelId,
        provider: 'ollama',
      });
    case 'openai':
    default:
      return new OpenAIModelProvider({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        modelId: config.modelId,
        provider: config.provider,
      });
  }
}
