export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  effects?: FigmaEffect[];
  characters?: string;
  style?: FigmaTextStyle;
  componentId?: string;
  constraints?: {
    horizontal: string;
    vertical: string;
  };
}

export interface FigmaFill {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  opacity?: number;
}

export interface FigmaStroke {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  opacity?: number;
}

export interface FigmaEffect {
  type: string;
  radius?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  offset?: {
    x: number;
    y: number;
  };
}

export interface FigmaTextStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing?: number;
  lineHeightPx?: number;
}

export interface FigmaFile {
  id: string;
  name: string;
  lastModified: string;
  document: FigmaNode;
  components: Record<string, FigmaComponentData>;
}

export interface FigmaComponentData {
  id: string;
  name: string;
  description?: string;
  documentationLinks?: Array<{
    uri: string;
  }>;
}

export interface FigmaImportRequest {
  figmaUrl: string;
  figmaToken: string;
  frameNames?: string[];
  generateComponentLibrary?: boolean;
}

export interface FigmaImportResult {
  id: string;
  title: string;
  components: ParsedComponent[];
  assets: FigmaAsset[];
  designTokens: DesignTokens;
}

export interface ParsedComponent {
  id: string;
  name: string;
  displayName: string;
  code: string;
  props: ComponentProp[];
  children?: ParsedComponent[];
}

export interface ComponentProp {
  name: string;
  type: string;
  defaultValue?: any;
  required?: boolean;
}

export interface FigmaAsset {
  id: string;
  name: string;
  type: 'color' | 'typography' | 'spacing' | 'shadow';
  value: any;
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, any>;
  spacing: Record<string, string>;
  shadows: Record<string, string>;
}

export interface FigmaImportState {
  isImporting: boolean;
  currentImport?: FigmaImportResult;
  importHistory: FigmaImportResult[];
  error?: string;
}
