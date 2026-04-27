import type { BrowserTool, PageSnapshot } from '../interfaces/browser';
import type { JsonValue, ToolResult, ToolSpec } from '../interfaces/tool';

type CdpResponse<T = unknown> = { id: number; result?: T; error?: { message?: string } };

type RuntimeEvaluateResult = {
  result?: { value?: unknown };
};

type CaptureScreenshotResult = { data: string };

interface CdpClient {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
}

class WebSocketCdpClient implements CdpClient {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.socket.onmessage = event => {
      const response = JSON.parse(String(event.data)) as CdpResponse;
      if (response.id == null) return;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.error) pending.reject(new Error(response.error.message ?? 'CDP command failed'));
      else pending.resolve(response.result);
    };
    this.socket.onerror = () => {
      this.rejectAll(new Error('CDP WebSocket error'));
    };
    this.socket.onclose = () => {
      this.rejectAll(new Error('CDP WebSocket closed'));
    };
  }

  static connect(endpoint: string): Promise<WebSocketCdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      socket.onopen = () => resolve(new WebSocketCdpClient(socket));
      socket.onerror = () => reject(new Error(`Failed to connect to CDP endpoint: ${endpoint}`));
    });
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      this.socket.send(payload);
    });
  }

  close(): void {
    this.socket.close();
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

export interface LightpandaBrowserToolOptions {
  /** CDP page WebSocket endpoint, for example ws://127.0.0.1:9222/devtools/page/<id>. */
  endpoint: string;
}

export class LightpandaBrowserTool implements BrowserTool {
  private clientPromise: Promise<CdpClient> | null = null;
  private currentUrl = 'about:blank';

  constructor(private readonly options: LightpandaBrowserToolOptions) {}

  async listTools(): Promise<ToolSpec[]> {
    return [
      {
        name: 'browser.navigate',
        description: 'Navigate Lightpanda via CDP and return a page snapshot.',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      },
      {
        name: 'browser.extract',
        description: 'Extract textContent for a CSS selector from the current page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] },
      },
      {
        name: 'browser.click',
        description: 'Click a CSS selector in the current page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] },
        requiresApproval: true,
      },
      {
        name: 'browser.type',
        description: 'Type text into a CSS selector in the current page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] },
        requiresApproval: true,
      },
      {
        name: 'browser.screenshot',
        description: 'Capture a PNG screenshot from the current page.',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, JsonValue>): Promise<ToolResult> {
    try {
      switch (name) {
        case 'browser.navigate':
          return { ok: true, content: await this.navigate(String(args.url ?? '')) as unknown as JsonValue };
        case 'browser.extract':
          return { ok: true, content: await this.extract(String(args.selector ?? 'body')) };
        case 'browser.click':
          await this.click(String(args.selector ?? ''));
          return { ok: true };
        case 'browser.type':
          await this.type(String(args.selector ?? ''), String(args.text ?? ''));
          return { ok: true };
        case 'browser.screenshot':
          return { ok: true, content: Array.from(await this.screenshot()) };
        default:
          return { ok: false, error: `Unknown browser tool: ${name}` };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async navigate(url: string): Promise<PageSnapshot> {
    const client = await this.client();
    this.currentUrl = url;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Page.navigate', { url });
    await this.waitForLoad();
    return this.snapshot();
  }

  async extract(selector: string): Promise<string> {
    const value = await this.evaluate(`(() => document.querySelector(${JSON.stringify(selector)})?.textContent ?? '')()`);
    return typeof value === 'string' ? value.trim() : '';
  }

  async click(selector: string): Promise<void> {
    await this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Selector not found'); el.click(); })()`);
  }

  async type(selector: string, text: string): Promise<void> {
    await this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Selector not found'); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  }

  async screenshot(): Promise<Buffer> {
    const client = await this.client();
    const result = await client.send<CaptureScreenshotResult>('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(result.data, 'base64');
  }

  close(): void {
    this.clientPromise?.then(client => client.close()).catch(() => {});
    this.clientPromise = null;
  }

  private async snapshot(): Promise<PageSnapshot> {
    const [title, text, html] = await Promise.all([
      this.evaluate('document.title'),
      this.evaluate('document.body?.innerText ?? document.documentElement?.innerText ?? ""'),
      this.evaluate('document.documentElement?.outerHTML ?? ""'),
    ]);

    return {
      url: this.currentUrl,
      title: typeof title === 'string' ? title : undefined,
      text: typeof text === 'string' ? text : undefined,
      html: typeof html === 'string' ? html : undefined,
    };
  }

  private async evaluate(expression: string): Promise<unknown> {
    const client = await this.client();
    const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result?.value;
  }

  private async waitForLoad(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  private client(): Promise<CdpClient> {
    this.clientPromise ??= WebSocketCdpClient.connect(this.options.endpoint);
    return this.clientPromise;
  }
}
