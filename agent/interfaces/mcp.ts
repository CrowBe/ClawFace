import type { JsonValue, ToolResult, ToolSpec } from './tool';

export type ToolHandler = (args: Record<string, JsonValue>) => Promise<ToolResult>;

export interface McpServer {
  listTools(): Promise<ToolSpec[]>;
  callTool(name: string, args: Record<string, JsonValue>): Promise<ToolResult>;
  registerTool(spec: ToolSpec, handler: ToolHandler): void;
}
