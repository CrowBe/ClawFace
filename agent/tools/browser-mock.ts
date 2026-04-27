import type { BrowserTool, PageSnapshot } from '../interfaces/browser';
import type { JsonValue, ToolResult, ToolSpec } from '../interfaces/tool';

const DEFAULT_HTML = '<html><head><title>Mock page</title></head><body><main>Mock browser content</main></body></html>';

function textFromHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class MockBrowserTool implements BrowserTool {
  private snapshot: PageSnapshot;
  private typedValues = new Map<string, string>();
  private clickedSelectors: string[] = [];

  constructor(private readonly fixtures: Record<string, string> = {}) {
    this.snapshot = this.toSnapshot('mock://blank', DEFAULT_HTML);
  }

  async listTools(): Promise<ToolSpec[]> {
    return [
      {
        name: 'browser.navigate',
        description: 'Navigate the mock browser to a fixture URL and return a page snapshot.',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      },
      {
        name: 'browser.extract',
        description: 'Extract visible text for a selector from the current mock page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] },
      },
      {
        name: 'browser.click',
        description: 'Record a click on a selector in the current mock page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] },
      },
      {
        name: 'browser.type',
        description: 'Record text typed into a selector in the current mock page.',
        inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] },
      },
      {
        name: 'browser.screenshot',
        description: 'Return deterministic mock screenshot bytes.',
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
    const html = this.fixtures[url] ?? DEFAULT_HTML;
    this.snapshot = this.toSnapshot(url, html);
    return this.snapshot;
  }

  async extract(selector: string): Promise<string> {
    if (selector === 'html') return this.snapshot.html ?? '';
    if (selector === 'title') return this.snapshot.title ?? '';
    return this.snapshot.text ?? '';
  }

  async click(selector: string): Promise<void> {
    this.clickedSelectors.push(selector);
  }

  async type(selector: string, text: string): Promise<void> {
    this.typedValues.set(selector, text);
  }

  async screenshot(): Promise<Buffer> {
    return Buffer.from(`mock-screenshot:${this.snapshot.url}`);
  }

  get clicks() {
    return [...this.clickedSelectors];
  }

  get values() {
    return new Map(this.typedValues);
  }

  private toSnapshot(url: string, html: string): PageSnapshot {
    return {
      url,
      title: html.match(/<title>(.*?)<\/title>/i)?.[1],
      text: textFromHtml(html),
      html,
    };
  }
}
