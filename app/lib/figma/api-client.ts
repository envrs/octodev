import type { FigmaFile, FigmaNode } from '~/types/figma';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export class FigmaApiClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${FIGMA_API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      'X-Figma-Token': this.token,
      ...options?.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Figma API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async getFile(fileId: string): Promise<FigmaFile> {
    return this.request(`/files/${fileId}`, {
      method: 'GET',
    });
  }

  async getFileNodes(fileId: string, nodeIds: string[]): Promise<Record<string, FigmaNode>> {
    const params = new URLSearchParams();
    nodeIds.forEach((id) => params.append('ids', id));

    const response = await this.request<{
      nodes: Record<string, { document: FigmaNode }>;
    }>(`/files/${fileId}/nodes?${params}`, {
      method: 'GET',
    });

    const nodes: Record<string, FigmaNode> = {};
    for (const [id, data] of Object.entries(response.nodes)) {
      nodes[id] = data.document;
    }
    return nodes;
  }

  async getImages(
    fileId: string,
    nodeIds: string[],
  ): Promise<Record<string, string | null>> {
    const params = new URLSearchParams();
    nodeIds.forEach((id) => params.append('ids', id));

    const response = await this.request<{
      images: Record<string, string | null>;
    }>(`/files/${fileId}/images?${params}`, {
      method: 'GET',
    });

    return response.images;
  }

  extractFrames(document: FigmaNode): FigmaNode[] {
    const frames: FigmaNode[] = [];

    const traverse = (node: FigmaNode) => {
      if (node.type === 'FRAME' || node.type === 'COMPONENT') {
        frames.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(document);
    return frames;
  }

  extractColors(document: FigmaNode): Map<string, string> {
    const colors = new Map<string, string>();

    const traverse = (node: FigmaNode) => {
      if (node.fills) {
        node.fills.forEach((fill, index) => {
          if (fill.type === 'SOLID' && fill.color) {
            const hex = this.rgbToHex(fill.color);
            const colorName = `${node.name}-fill-${index}`.replace(/\s+/g, '-').toLowerCase();
            colors.set(colorName, hex);
          }
        });
      }

      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(document);
    return colors;
  }

  private rgbToHex(color: { r: number; g: number; b: number; a?: number }): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255)
        .toString(16)
        .padStart(2, '0');
      return hex;
    };

    const r = toHex(color.r);
    const g = toHex(color.g);
    const b = toHex(color.b);

    if (color.a !== undefined && color.a < 1) {
      const a = toHex(color.a);
      return `#${r}${g}${b}${a}`;
    }

    return `#${r}${g}${b}`;
  }
}

export const extractFileIdFromUrl = (url: string): string => {
  const match = url.match(/files\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Figma URL. Expected format: https://www.figma.com/file/FILE_ID/...');
  }
  return match[1];
};
