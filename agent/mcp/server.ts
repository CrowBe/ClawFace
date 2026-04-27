import type { JsonValue, ToolProvider, ToolResult, ToolSpec } from '../interfaces/tool';
import type { McpServer, ToolHandler } from '../interfaces/mcp';

export class InProcessMcpServer implements McpServer {
  private readonly tools = new Map<string, { spec: ToolSpec; handler: ToolHandler }>();

  async listTools(): Promise<ToolSpec[]> {
    return [...this.tools.values()].map(tool => tool.spec);
  }

  async callTool(name: string, args: Record<string, JsonValue>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };

    try {
      return await tool.handler(args);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  registerTool(spec: ToolSpec, handler: ToolHandler): void {
    if (this.tools.has(spec.name)) throw new Error(`Tool already registered: ${spec.name}`);
    this.tools.set(spec.name, { spec, handler });
  }

  async registerProvider(provider: ToolProvider): Promise<void> {
    const specs = await provider.listTools();
    specs.forEach(spec => {
      this.registerTool(spec, args => provider.executeTool(spec.name, args));
    });
  }
}

export async function createMcpServer(providers: ToolProvider[] = []): Promise<InProcessMcpServer> {
  const server = new InProcessMcpServer();
  for (const provider of providers) await server.registerProvider(provider);
  return server;
}
