import type { McpServer } from './mcp';
import type { ModelMessage, ModelProvider } from './model';

export interface HarnessConfig {
  host: string;
  port: number;
  protocolVersion: string;
}

export interface PairingSession {
  code: string;
  fingerprint: string;
  expiresAt: number;
}

export interface AgentSession {
  agentId: string;
  sessionKey: string;
  createdAt: number;
  revokedAt?: number;
}

export interface HarnessDependencies {
  modelProvider: ModelProvider;
  mcpServer: McpServer;
}

export interface HarnessAdapter {
  start(config: HarnessConfig, dependencies: HarnessDependencies): Promise<void>;
  stop(): Promise<void>;
  createPairingSession(): Promise<PairingSession>;
  revokeSession(sessionKey: string): Promise<void>;
  handleTurn(session: AgentSession, messages: ModelMessage[]): Promise<void>;
}
