export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonValue;
  requiresApproval?: boolean;
}

export interface ToolResult {
  ok: boolean;
  content?: JsonValue;
  error?: string;
  logs?: string[];
}

export interface ToolProvider {
  listTools(): Promise<ToolSpec[]>;
  executeTool(name: string, args: Record<string, JsonValue>): Promise<ToolResult>;
}
