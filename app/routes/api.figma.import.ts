import { json, type ActionFunction } from '@remix-run/node';
import { FigmaApiClient, extractFileIdFromUrl } from '~/lib/figma/api-client';
import { FigmaDesignParser } from '~/lib/figma/design-parser';
import { ComponentGenerator } from '~/lib/figma/component-generator';
import type { FigmaImportRequest } from '~/types/figma';

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data: FigmaImportRequest = await request.json();

    if (!data.figmaUrl || !data.figmaToken) {
      return json(
        { error: 'Missing Figma URL or API token' },
        { status: 400 },
      );
    }

    // Extract file ID from Figma URL
    const fileId = extractFileIdFromUrl(data.figmaUrl);

    // Initialize Figma API client
    const figmaClient = new FigmaApiClient(data.figmaToken);

    // Fetch the Figma file
    const file = await figmaClient.getFile(fileId);

    // Extract frames from the design
    const frames = figmaClient.extractFrames(file.document);

    if (frames.length === 0) {
      return json(
        { error: 'No frames found in Figma file. Please ensure your file has frames to import.' },
        { status: 400 },
      );
    }

    // Parse design and generate components
    const title = file.name;
    const result = await new ComponentGenerator().generateFromFrames(frames, title);

    // Generate project structure
    const files = new ComponentGenerator().generateProjectStructure(result);

    // Create a summary of the import
    const summary = {
      id: result.id,
      title: result.title,
      componentCount: result.components.length,
      files: Object.keys(files),
      components: result.components.map((c) => ({
        name: c.name,
        displayName: c.displayName,
        props: c.props,
      })),
    };

    return json({
      success: true,
      import: summary,
      projectStructure: files,
      code: result.components.map((c) => c.code).join('\n\n// ---\n\n'),
    });
  } catch (error) {
    console.error('Figma import error:', error);

    const message = error instanceof Error ? error.message : 'Failed to import Figma design';

    return json(
      { error: message },
      { status: 500 },
    );
  }
};
