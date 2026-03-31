import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  FindExamplesInputSchema,
  GetMigrationNotesInputSchema,
  ResolveFeatureMatrixInputSchema,
  SearchRevogridDocsInputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../types/catalog.js';
import { registerPrompts } from './prompts/index.js';
import { readFeatureMatrixResource } from './resources/featureMatrix.js';
import { readGettingStartedResource } from './resources/gettingStarted.js';
import { readAllVersionsResource, readLatestVersionResource } from './resources/versions.js';
import { handleFindExamples } from './tools/findExamples.js';
import { handleGetMigrationNotes } from './tools/getMigrationNotes.js';
import { handleResolveFeatureMatrix } from './tools/resolveFeatureMatrix.js';
import { handleSearchRevogridDocs } from './tools/searchRevogridDocs.js';

function asToolResponse<TPayload extends Record<string, unknown>>(payload: TPayload) {
  return {
    structuredContent: payload,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload)
      }
    ]
  };
}

function asResourceResponse(uri: string, payload: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload)
      }
    ]
  };
}

export function createMcpServer(
  services: AppServices,
  context: RequestContext,
): McpServer {
  const server = new Server({
    name: 'revogrid-mcp',
    version: '0.1.0'
  });

  server.registerTool(
    'search_revogrid_docs',
    {
      title: 'Search RevoGrid Docs',
      description: 'Search docs, API reference, examples, and migration notes for RevoGrid.',
      inputSchema: SearchRevogridDocsInputSchema.shape
    },
    async (input) => asToolResponse(await handleSearchRevogridDocs(input, services, context)),
  );

  server.registerTool(
    'find_examples',
    {
      title: 'Find RevoGrid Examples',
      description: 'Search runnable or live RevoGrid examples only.',
      inputSchema: FindExamplesInputSchema.shape
    },
    async (input) => asToolResponse(await handleFindExamples(input, services, context)),
  );

  server.registerTool(
    'resolve_feature_matrix',
    {
      title: 'Resolve RevoGrid Feature',
      description: 'Resolve whether a RevoGrid feature exists, whether it is Pro, and where to learn it.',
      inputSchema: ResolveFeatureMatrixInputSchema.shape
    },
    async (input) => asToolResponse(await handleResolveFeatureMatrix(input, services, context)),
  );

  server.registerTool(
    'get_migration_notes',
    {
      title: 'Get Migration Notes',
      description: 'Get upgrade notes between RevoGrid versions.',
      inputSchema: GetMigrationNotesInputSchema.shape
    },
    async (input) => asToolResponse(await handleGetMigrationNotes(input, services, context)),
  );

  server.registerResource(
    'latest-version',
    'revogrid://versions/latest',
    {
      title: 'Latest RevoGrid Version',
      description: 'Returns the latest indexed RevoGrid version.',
      mimeType: 'application/json'
    },
    async (uri) => asResourceResponse(uri.href, await readLatestVersionResource(services, context)),
  );

  server.registerResource(
    'all-versions',
    'revogrid://versions/all',
    {
      title: 'All RevoGrid Versions',
      description: 'Returns all indexed versions in the catalog.',
      mimeType: 'application/json'
    },
    async (uri) => asResourceResponse(uri.href, await readAllVersionsResource(services, context)),
  );

  server.registerResource(
    'feature-matrix',
    'revogrid://features/matrix',
    {
      title: 'RevoGrid Feature Matrix',
      description: 'Structured feature availability catalog.',
      mimeType: 'application/json'
    },
    async (uri) => asResourceResponse(uri.href, await readFeatureMatrixResource(services, context)),
  );

  server.registerResource(
    'react-getting-started',
    'revogrid://frameworks/react/getting-started',
    {
      title: 'React getting started',
      description: 'Getting started resources for React.',
      mimeType: 'application/json'
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('react', services, context)),
  );

  server.registerResource(
    'vue-getting-started',
    'revogrid://frameworks/vue/getting-started',
    {
      title: 'Vue getting started',
      description: 'Getting started resources for Vue.',
      mimeType: 'application/json'
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('vue', services, context)),
  );

  server.registerResource(
    'angular-getting-started',
    'revogrid://frameworks/angular/getting-started',
    {
      title: 'Angular getting started',
      description: 'Getting started resources for Angular.',
      mimeType: 'application/json'
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('angular', services, context)),
  );

  registerPrompts(server);

  return server;
}
