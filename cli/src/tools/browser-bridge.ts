/**
 * Browser Bridge Module
 * 
 * Handles communication between CLI and browser environment.
 * Supports Puppeteer, Playwright, and direct HTTP requests for tools.
 */

import { createLogger } from "@/utils/logger";
import type { BrowserToolParams, BrowserToolResult } from "./browser-tools";

const logger = createLogger("browser-bridge");

/**
 * Browser bridge configuration
 */
export interface BrowserBridgeConfig {
  engine: 'puppeteer' | 'playwright' | 'http';
  timeout?: number;
  headless?: boolean;
  proxy?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BrowserBridgeConfig = {
  engine: 'http',
  timeout: 30000,
  headless: true,
};

/**
 * Browser Bridge - Main execution engine for browser tools
 */
export class BrowserBridge {
  private config: BrowserBridgeConfig;
  private requestTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<BrowserBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.debug({ config: this.config }, "BrowserBridge initialized");
  }

  /**
   * Execute a browser tool
   */
  async execute(toolName: string, params: BrowserToolParams): Promise<BrowserToolResult> {
    const startTime = Date.now();
    
    try {
      logger.debug({ tool: toolName, params }, "Executing browser tool");

      let result: BrowserToolResult;

      switch (toolName) {
        case 'webSearch':
          result = await this.executeWebSearch(params);
          break;
        case 'screenshot':
          result = await this.executeScreenshot(params);
          break;
        case 'domInspect':
          result = await this.executeDomInspect(params);
          break;
        case 'webScrape':
          result = await this.executeWebScrape(params);
          break;
        default:
          throw new Error(`Unknown browser tool: ${toolName}`);
      }

      result.duration = Date.now() - startTime;
      logger.debug({ tool: toolName, duration: result.duration }, "Tool execution completed");
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ tool: toolName, error: errorMessage }, "Tool execution failed");
      
      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Execute web search
   */
  private async executeWebSearch(params: BrowserToolParams): Promise<BrowserToolResult> {
    const { query, limit = 5 } = params;

    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }

    if (this.config.engine === 'http') {
      return this.executeWebSearchHTTP(query, limit as number);
    } else if (this.config.engine === 'puppeteer') {
      return this.executeWebSearchPuppeteer(query, limit as number);
    } else {
      throw new Error(`Unsupported engine: ${this.config.engine}`);
    }
  }

  /**
   * Execute web search using HTTP API (DuckDuckGo)
   */
  private async executeWebSearchHTTP(query: string, limit: number): Promise<BrowserToolResult> {
    try {
      // Using DuckDuckGo Instant Answer API (no auth required)
      const url = new URL('https://api.duckduckgo.com/');
      url.searchParams.append('q', query);
      url.searchParams.append('format', 'json');
      url.searchParams.append('no_redirect', '1');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      try {
        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();

        // Format results
        const results = {
          query,
          abstract: data.AbstractText || '',
          abstractSource: data.AbstractSource || '',
          abstractURL: data.AbstractURL || '',
          results: limit,
          timestamp: new Date().toISOString(),
        };

        return {
          success: true,
          data: results,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute web search using Puppeteer
   */
  private async executeWebSearchPuppeteer(query: string, limit: number): Promise<BrowserToolResult> {
    try {
      // Dynamic import to avoid requiring puppeteer if not using it
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: this.config.headless,
        args: this.config.proxy ? [`--proxy-server=${this.config.proxy}`] : [],
      });

      try {
        const page = await browser.newPage();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}`;

        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const results = await page.evaluate(() => {
          const items = document.querySelectorAll('div.g');
          return Array.from(items).map((item) => ({
            title: item.querySelector('h3')?.textContent || '',
            url: (item.querySelector('a') as HTMLAnchorElement)?.href || '',
            description: item.querySelector('div.VwiC3b')?.textContent || '',
          }));
        });

        return {
          success: true,
          data: { query, results, count: results.length },
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error(`Puppeteer search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute screenshot tool
   */
  private async executeScreenshot(params: BrowserToolParams): Promise<BrowserToolResult> {
    const { url, width = 1920, height = 1080 } = params;

    if (!url || typeof url !== 'string') {
      throw new Error('URL parameter is required and must be a string');
    }

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: this.config.headless,
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({
          width: width as number,
          height: height as number,
        });

        await page.goto(url, { waitUntil: 'networkidle2' });
        const screenshot = await page.screenshot({ encoding: 'base64' });

        return {
          success: true,
          data: {
            url,
            screenshot: `data:image/png;base64,${screenshot}`,
            width,
            height,
          },
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute DOM inspection tool
   */
  private async executeDomInspect(params: BrowserToolParams): Promise<BrowserToolResult> {
    const { url, selector = 'body' } = params;

    if (!url || typeof url !== 'string') {
      throw new Error('URL parameter is required and must be a string');
    }

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: this.config.headless,
      });

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        const elements = await page.evaluate((sel: string) => {
          const items = document.querySelectorAll(sel);
          return Array.from(items).map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.substring(0, 200),
            html: el.outerHTML.substring(0, 500),
            classes: Array.from(el.classList),
            id: el.id,
          }));
        }, selector as string);

        return {
          success: true,
          data: {
            url,
            selector,
            count: elements.length,
            elements: elements.slice(0, 10), // Limit to first 10
          },
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error(`DOM inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute web scraping tool
   */
  private async executeWebScrape(params: BrowserToolParams): Promise<BrowserToolResult> {
    const { url, selector, attributes = ['text'] } = params;

    if (!url || typeof url !== 'string') {
      throw new Error('URL parameter is required and must be a string');
    }

    if (!selector || typeof selector !== 'string') {
      throw new Error('Selector parameter is required and must be a string');
    }

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: this.config.headless,
      });

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        const data = await page.evaluate(
          (sel: string, attrs: string[]) => {
            const items = document.querySelectorAll(sel);
            return Array.from(items).map((el) => {
              const obj: Record<string, any> = {};
              for (const attr of attrs) {
                if (attr === 'text') {
                  obj.text = el.textContent;
                } else if (attr === 'html') {
                  obj.html = el.innerHTML;
                } else {
                  obj[attr] = (el as any).getAttribute(attr);
                }
              }
              return obj;
            });
          },
          selector as string,
          attributes as string[]
        );

        return {
          success: true,
          data: {
            url,
            selector,
            count: data.length,
            data: data.slice(0, 50), // Limit to first 50
          },
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error(`Web scraping failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Global bridge instance
 */
let globalBridge: BrowserBridge | null = null;

export function getBrowserBridge(config?: Partial<BrowserBridgeConfig>): BrowserBridge {
  if (!globalBridge) {
    globalBridge = new BrowserBridge(config);
  }
  return globalBridge;
}

export function resetBrowserBridge(): void {
  globalBridge = null;
}
