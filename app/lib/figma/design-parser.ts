import type { FigmaNode, ParsedComponent, DesignTokens, ComponentProp } from '~/types/figma';

export class FigmaDesignParser {
  parseFrame(frame: FigmaNode): ParsedComponent {
    const name = frame.name.replace(/\s+/g, '');
    const displayName = frame.name;

    const props = this.extractProps(frame);
    const code = this.generateComponentCode(name, frame, props);

    return {
      id: frame.id,
      name,
      displayName,
      code,
      props,
      children: frame.children ? this.parseChildren(frame.children) : [],
    };
  }

  private parseChildren(children: FigmaNode[]): ParsedComponent[] {
    return children
      .filter((child) => child.type === 'COMPONENT' || child.type === 'FRAME')
      .map((child) => this.parseFrame(child));
  }

  private extractProps(node: FigmaNode): ComponentProp[] {
    const props: ComponentProp[] = [];

    if (node.characters) {
      props.push({
        name: 'text',
        type: 'string',
        defaultValue: node.characters,
      });
    }

    if (node.opacity !== undefined && node.opacity < 1) {
      props.push({
        name: 'opacity',
        type: 'number',
        defaultValue: node.opacity,
      });
    }

    return props;
  }

  private generateComponentCode(
    name: string,
    node: FigmaNode,
    props: ComponentProp[],
  ): string {
    const width = node.absoluteBoundingBox?.width || 'auto';
    const height = node.absoluteBoundingBox?.height || 'auto';
    const backgroundColor = this.getBackgroundColor(node);
    const borderRadius = node.cornerRadius ? `${Math.round(node.cornerRadius)}px` : '0';

    const propsInterface = props.length > 0 ? this.generatePropsInterface(name, props) : '';

    const code = `'use client';

import React from 'react';

${propsInterface}

export const ${name}: React.FC<${name}Props> = (${props.length > 0 ? `{ ${props.map((p) => p.name).join(', ')} }` : ''}) => {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: '${width}px',
        height: '${height}px',
        backgroundColor: '${backgroundColor}',
        borderRadius: '${borderRadius}',
        opacity: ${props.find((p) => p.name === 'opacity')?.defaultValue || 1},
      }}
    >
      {${props.find((p) => p.name === 'text') ? 'text' : "'Content'"}}
    </div>
  );
};

export default ${name};`;

    return code;
  }

  private generatePropsInterface(name: string, props: ComponentProp[]): string {
    const propsStr = props
      .map((prop) => `  ${prop.name}${prop.required ? '' : '?'}: ${prop.type};`)
      .join('\n');

    return `interface ${name}Props {
${propsStr}
}`;
  }

  private getBackgroundColor(node: FigmaNode): string {
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        return this.rgbToHex(fill.color);
      }
    }
    return '#ffffff';
  }

  private rgbToHex(color: { r: number; g: number; b: number }): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255)
        .toString(16)
        .padStart(2, '0');
      return hex;
    };

    const r = toHex(color.r);
    const g = toHex(color.g);
    const b = toHex(color.b);

    return `#${r}${g}${b}`;
  }

  extractDesignTokens(frames: FigmaNode[]): DesignTokens {
    const colors: Record<string, string> = {};
    const spacing: Record<string, string> = {};
    const shadows: Record<string, string> = {};
    const typography: Record<string, any> = {};

    frames.forEach((frame) => {
      this.traverseNode(frame, {
        colors,
        spacing,
        shadows,
        typography,
      });
    });

    return {
      colors,
      spacing,
      shadows,
      typography,
    };
  }

  private traverseNode(
    node: FigmaNode,
    tokens: DesignTokens,
  ): void {
    // Extract colors from fills
    if (node.fills) {
      node.fills.forEach((fill, index) => {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = this.rgbToHex(fill.color);
          const colorName = `color-${node.name}-${index}`.replace(/\s+/g, '-').toLowerCase();
          tokens.colors[colorName] = hex;
        }
      });
    }

    // Extract shadows
    if (node.effects) {
      node.effects.forEach((effect, index) => {
        if (effect.type === 'DROP_SHADOW' && effect.radius) {
          const shadowName = `shadow-${node.name}-${index}`.replace(/\s+/g, '-').toLowerCase();
          const offsetX = effect.offset?.x || 0;
          const offsetY = effect.offset?.y || 0;
          tokens.shadows[shadowName] = `${offsetX}px ${offsetY}px ${effect.radius}px rgba(0, 0, 0, 0.1)`;
        }
      });
    }

    // Extract spacing
    if (node.absoluteBoundingBox) {
      const spacingName = `spacing-${node.name}`.replace(/\s+/g, '-').toLowerCase();
      tokens.spacing[spacingName] = `${Math.round(node.absoluteBoundingBox.width)}px`;
    }

    // Recurse into children
    if (node.children) {
      node.children.forEach((child) => this.traverseNode(child, tokens));
    }
  }
}
