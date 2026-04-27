import type { ToolProvider } from './tool';

export interface PageSnapshot {
  url: string;
  title?: string;
  text?: string;
  html?: string;
}

export interface BrowserTool extends ToolProvider {
  navigate(url: string): Promise<PageSnapshot>;
  extract(selector: string): Promise<string>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  screenshot(): Promise<Buffer>;
}
