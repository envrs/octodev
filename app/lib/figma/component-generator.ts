import type { FigmaImportResult, ParsedComponent, DesignTokens } from '~/types/figma';
import { FigmaDesignParser } from './design-parser';
import type { FigmaNode } from '~/types/figma';

export class ComponentGenerator {
  private parser: FigmaDesignParser;

  constructor() {
    this.parser = new FigmaDesignParser();
  }

  async generateFromFrames(
    frames: FigmaNode[],
    title: string,
  ): Promise<FigmaImportResult> {
    const components = frames.map((frame) => this.parser.parseFrame(frame));
    const designTokens = this.parser.extractDesignTokens(frames);

    return {
      id: `figma-${Date.now()}`,
      title,
      components,
      assets: [],
      designTokens,
    };
  }

  generateComponentFile(component: ParsedComponent): string {
    return component.code;
  }

  generateIndexFile(components: ParsedComponent[]): string {
    const exports = components
      .map((c) => `export { default as ${c.name} } from './${c.name}';`)
      .join('\n');

    return `// Auto-generated from Figma import
${exports}
`;
  }

  generateStylesFile(tokens: DesignTokens): string {
    const colorVars = Object.entries(tokens.colors)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join('\n');

    const spacingVars = Object.entries(tokens.spacing)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join('\n');

    const shadowVars = Object.entries(tokens.shadows)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join('\n');

    return `:root {
${colorVars}
${spacingVars}
${shadowVars}
}
`;
  }

  generateReadme(title: string, components: ParsedComponent[]): string {
    const componentsList = components.map((c) => `- \`${c.name}\` - ${c.displayName}`).join('\n');

    return `# ${title}

Auto-generated React components from Figma design.

## Components

${componentsList}

## Usage

\`\`\`jsx
import { ${components.map((c) => c.name).join(', ')} } from '@/components/figma/${title}';

export default function MyPage() {
  return (
    <div>
      <${components[0]?.name || 'Component'} />
    </div>
  );
}
\`\`\`

## Design Tokens

This package includes design tokens extracted from your Figma file:

- Colors
- Spacing
- Shadows
- Typography

## Notes

- Components are fully functional React components
- Built with TypeScript for type safety
- Styled with inline CSS and Tailwind utilities
- Fully customizable via props

---

Generated with Octodev Figma Importer
`;
  }

  generateProjectStructure(
    result: FigmaImportResult,
  ): Record<string, string> {
    const files: Record<string, string> = {};

    // Generate component files
    result.components.forEach((component) => {
      files[`components/${component.name}.tsx`] = this.generateComponentFile(component);
      
      if (component.children && component.children.length > 0) {
        component.children.forEach((child) => {
          files[`components/${component.name}/${child.name}.tsx`] =
            this.generateComponentFile(child);
        });
      }
    });

    // Generate index file
    files['components/index.ts'] = this.generateIndexFile(result.components);

    // Generate styles file
    files['styles/design-tokens.css'] = this.generateStylesFile(result.designTokens);

    // Generate README
    files['README.md'] = this.generateReadme(result.title, result.components);

    // Generate package.json
    files['package.json'] = JSON.stringify(
      {
        name: `@figma/${result.title.toLowerCase().replace(/\s+/g, '-')}`,
        version: '1.0.0',
        description: `React components generated from Figma`,
        main: 'components/index.ts',
        exports: {
          '.': './components/index.ts',
          './styles': './styles/design-tokens.css',
        },
        keywords: ['figma', 'components', 'react'],
        author: 'Octodev',
        license: 'MIT',
      },
      null,
      2,
    );

    return files;
  }
}

export const componentGenerator = new ComponentGenerator();
