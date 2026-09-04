import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { ZodError } from 'zod';
import {
  FindExamplesInputSchema,
  FindExamplesOutputSchema,
  GetMigrationNotesInputSchema,
  GetMigrationNotesOutputSchema,
  InspectRevogridApiInputSchema,
  InspectRevogridApiOutputSchema,
  ListRevogridCapabilitiesInputSchema,
  ListRevogridCapabilitiesOutputSchema,
  PlanRevogridImplementationInputSchema,
  PlanRevogridImplementationOutputSchema,
  ResolveFeatureMatrixInputSchema,
  ResolveFeatureMatrixOutputSchema,
  SearchRevogridDocsInputSchema,
  SearchRevogridDocsOutputSchema,
  ValidateRevogridUsageInputSchema,
  ValidateRevogridUsageOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../types/catalog.js';
import { InvalidCursorError } from '../services/pagination.js';
import { registerPrompts } from './prompts/index.js';
import { registerDeveloperCatalogResources } from './resources/developerCatalog.js';
import { readFeatureMatrixResource } from './resources/featureMatrix.js';
import { readGettingStartedResource } from './resources/gettingStarted.js';
import {
  readAllVersionsResource,
  readCatalogCoverageResource,
  readLatestVersionResource
} from './resources/versions.js';
import { handleFindExamples } from './tools/findExamples.js';
import { handleGetMigrationNotes } from './tools/getMigrationNotes.js';
import { handleResolveFeatureMatrix } from './tools/resolveFeatureMatrix.js';
import { handleSearchRevogridDocs } from './tools/searchRevogridDocs.js';
import {
  handleInspectRevogridApi,
  handleListRevogridCapabilities,
  handlePlanRevogridImplementation,
  handleValidateRevogridUsage
} from './tools/developerCopilot.js';

export type ToolObservation = {
  tool: string;
  durationMs: number;
  zeroResult: boolean;
  internalResult: boolean;
  diagnosticCount: number;
};

type ToolObserver = (observation: ToolObservation) => void;

const publicResourceCache = { ttlMs: 60_000, cacheScope: 'public' as const };

function asToolResponse<TPayload extends Record<string, unknown>>(
  tool: string,
  payload: TPayload,
): CallToolResult {
  return {
    structuredContent: payload,
    content: [
      {
        type: 'text' as const,
        text: summarizeToolResult(tool, payload)
      },
      ...collectResourceLinks(payload)
    ]
  };
}

function collectResourceLinks(payload: Record<string, unknown>): CallToolResult['content'] {
  const resultItems: unknown[] = Array.isArray(payload.results) ? payload.results as unknown[] : [];
  const records = [payload.match, ...resultItems]
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .slice(0, 5);

  return records.flatMap((record) => {
    const id = typeof record.id === 'string' ? record.id : undefined;
    const packageName = typeof record.packageName === 'string' ? record.packageName : undefined;
    const name = typeof record.name === 'string' ? record.name : id;
    const resourceUri = typeof record.resourceUri === 'string' ? record.resourceUri : undefined;
    if (resourceUri) {
      const resourceName = name ?? id ?? resourceUri;
      return [{
        type: 'resource_link' as const,
        name: resourceName,
        title: resourceName,
        uri: resourceUri,
        mimeType: 'application/json'
      }];
    }
    if (id && Array.isArray(record.packages)) {
      return [{
        type: 'resource_link' as const,
        name: name ?? id,
        title: name ?? id,
        uri: `revogrid://examples/${encodeURIComponent(id)}`,
        mimeType: 'application/json'
      }];
    }
    if (id && packageName && Array.isArray(record.frameworks)) {
      return [{
        type: 'resource_link' as const,
        name: name ?? id,
        title: name ?? id,
        uri: `revogrid://capabilities/${encodeURIComponent(id)}`,
        mimeType: 'application/json'
      }];
    }
    const symbols = Array.isArray(record.symbols)
      ? record.symbols.filter((value): value is string => typeof value === 'string')
      : [];
    if (packageName && symbols[0]) {
      const qualifiedName = `${packageName}#${symbols[0]}`;
      return [{
        type: 'resource_link' as const,
        name: qualifiedName,
        title: qualifiedName,
        uri: `revogrid://symbols/${encodeURIComponent(qualifiedName)}`,
        mimeType: 'application/json'
      }];
    }
    return [];
  });
}

function summarizeToolResult(tool: string, payload: Record<string, unknown>): string {
  if (Array.isArray(payload.results)) {
    return `${tool}: ${payload.results.length} result(s)${payload.nextCursor ? '; another page is available' : ''}. Structured content contains the records.`;
  }
  if (typeof payload.status === 'string') {
    return `${tool}: ${payload.status}${typeof payload.correction === 'string' ? `. ${payload.correction}` : '.'}`;
  }
  if (typeof payload.valid === 'boolean') {
    const count = Array.isArray(payload.diagnostics) ? payload.diagnostics.length : 0;
    return `${tool}: ${payload.valid ? 'valid' : 'invalid'} with ${count} diagnostic(s).`;
  }
  if (typeof payload.objective === 'string') {
    const packages = Array.isArray(payload.packages) ? payload.packages.length : 0;
    const unresolved = Array.isArray(payload.unresolved) ? payload.unresolved.length : 0;
    return `${tool}: blueprint uses ${packages} package(s) with ${unresolved} unresolved requirement(s).`;
  }
  if (typeof payload.featureName === 'string') {
    return `${tool}: ${payload.featureName} is ${payload.supported === false ? 'not supported' : 'supported'}${payload.requiresPro === true ? ' and requires Pro metadata' : ''}.`;
  }
  if (typeof payload.fromVersion === 'string' && typeof payload.toVersion === 'string') {
    return `${tool}: migration guidance from ${payload.fromVersion} to ${payload.toVersion}.`;
  }
  return `${tool}: completed. Structured content contains the result.`;
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

export function createMcpServer(services: AppServices, observer?: ToolObserver): McpServer {
  const server = new McpServer({
    name: 'revogrid-mcp',
    version: '2.0.0'
  }, {
    instructions: 'Use public supported exports by default. Resolve exact APIs before implementation planning, preserve requiresPro package guidance, and treat linked RevoGrid source evidence as authoritative. Internal source requires explicit opt-in.'
  });

  const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  };

  server.registerTool(
    'search_revogrid_docs',
    {
      title: 'Search RevoGrid Docs',
      description: 'Use for broad RevoGrid questions or when the exact API name is unknown. Searches source-grounded docs and API evidence; defaults to public exports.',
      inputSchema: SearchRevogridDocsInputSchema,
      outputSchema: SearchRevogridDocsOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('search_revogrid_docs', observer, () => handleSearchRevogridDocs(input, services)),
  );

  server.registerTool(
    'find_examples',
    {
      title: 'Find RevoGrid Examples',
      description: 'Use when implementation evidence should be a runnable or registered RevoGrid example, optionally filtered by framework and package.',
      inputSchema: FindExamplesInputSchema,
      outputSchema: FindExamplesOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('find_examples', observer, () => handleFindExamples(input, services)),
  );

  server.registerTool(
    'resolve_feature_matrix',
    {
      title: 'Resolve RevoGrid Feature',
      description: 'Resolve whether a RevoGrid feature exists, whether it is Pro, and where to learn it.',
      inputSchema: ResolveFeatureMatrixInputSchema,
      outputSchema: ResolveFeatureMatrixOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('resolve_feature_matrix', observer, () => handleResolveFeatureMatrix(input, services)),
  );

  server.registerTool(
    'get_migration_notes',
    {
      title: 'Get Migration Notes',
      description: 'Get upgrade notes between RevoGrid versions.',
      inputSchema: GetMigrationNotesInputSchema,
      outputSchema: GetMigrationNotesOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('get_migration_notes', observer, () => handleGetMigrationNotes(input, services)),
  );

  server.registerTool(
    'list_revogrid_capabilities',
    {
      title: 'List RevoGrid Capabilities',
      description: 'Start here to discover supported public capabilities and package ownership. Returns compact paginated summaries linked to detailed resources.',
      inputSchema: ListRevogridCapabilitiesInputSchema,
      outputSchema: ListRevogridCapabilitiesOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('list_revogrid_capabilities', observer, () => handleListRevogridCapabilities(input, services)),
  );

  server.registerTool(
    'inspect_revogrid_api',
    {
      title: 'Inspect RevoGrid API',
      description: 'Use after discovery to resolve one exact symbol or capability. Returns ambiguity candidates instead of guessing and includes its supported import and evidence.',
      inputSchema: InspectRevogridApiInputSchema,
      outputSchema: InspectRevogridApiOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('inspect_revogrid_api', observer, () => handleInspectRevogridApi(input, services)),
  );

  server.registerTool(
    'plan_revogrid_implementation',
    {
      title: 'Plan RevoGrid Implementation',
      description: 'Use after resolving capability names to compose a deterministic package, plugin-order, configuration, lifecycle, and compatibility blueprint.',
      inputSchema: PlanRevogridImplementationInputSchema,
      outputSchema: PlanRevogridImplementationOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('plan_revogrid_implementation', observer, () => handlePlanRevogridImplementation(input, services)),
  );

  server.registerTool(
    'validate_revogrid_usage',
    {
      title: 'Validate RevoGrid Usage',
      description: 'Use before implementation handoff to statically check structured RevoGrid imports, configuration, dependencies, versions, and optional bounded source. Never executes code.',
      inputSchema: ValidateRevogridUsageInputSchema,
      outputSchema: ValidateRevogridUsageOutputSchema,
      annotations: readOnlyAnnotations
    },
    async (input) => runObserved('validate_revogrid_usage', observer, () => handleValidateRevogridUsage(input, services)),
  );

  server.registerResource(
    'latest-version',
    'revogrid://versions/latest',
    {
      title: 'Latest RevoGrid Version',
      description: 'Returns the latest indexed RevoGrid version.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) => asResourceResponse(uri.href, await readLatestVersionResource(services)),
  );

  server.registerResource(
    'all-versions',
    'revogrid://versions/all',
    {
      title: 'All RevoGrid Versions',
      description: 'Returns all indexed versions in the catalog.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) => asResourceResponse(uri.href, await readAllVersionsResource(services)),
  );

  server.registerResource(
    'catalog-coverage',
    'revogrid://catalog/coverage',
    {
      title: 'Indexed Catalog Coverage',
      description: 'Summary of indexed chunk coverage by repository, surface, doc type, and path.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) => asResourceResponse(uri.href, await readCatalogCoverageResource(services)),
  );

  server.registerResource(
    'feature-matrix',
    'revogrid://features/matrix',
    {
      title: 'RevoGrid Feature Matrix',
      description: 'Structured feature availability catalog.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) => asResourceResponse(uri.href, await readFeatureMatrixResource(services)),
  );

  server.registerResource(
    'react-getting-started',
    'revogrid://frameworks/react/getting-started',
    {
      title: 'React getting started',
      description: 'Getting started resources for React.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('react', services)),
  );

  server.registerResource(
    'vue-getting-started',
    'revogrid://frameworks/vue/getting-started',
    {
      title: 'Vue getting started',
      description: 'Getting started resources for Vue.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('vue', services)),
  );

  server.registerResource(
    'angular-getting-started',
    'revogrid://frameworks/angular/getting-started',
    {
      title: 'Angular getting started',
      description: 'Getting started resources for Angular.',
      mimeType: 'application/json',
      cacheHint: publicResourceCache
    },
    async (uri) =>
      asResourceResponse(uri.href, await readGettingStartedResource('angular', services)),
  );

  registerPrompts(server);
  registerDeveloperCatalogResources(server, services);

  return server;
}

async function runObserved<TPayload extends Record<string, unknown>>(
  tool: string,
  observer: ToolObserver | undefined,
  operation: () => Promise<TPayload>,
): Promise<CallToolResult> {
  const startedAt = performance.now();
  try {
    const payload = await operation();
    observer?.({
      tool,
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      zeroResult: hasZeroResults(payload),
      internalResult: containsInternalResult(payload),
      diagnosticCount: Array.isArray(payload.diagnostics) ? payload.diagnostics.length : 0
    });
    return asToolResponse(tool, payload);
  } catch (error) {
    observer?.({
      tool,
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      zeroResult: true,
      internalResult: false,
      diagnosticCount: 1
    });
    return {
      isError: true,
      content: [{ type: 'text', text: formatToolError(tool, error) }]
    };
  }
}

function containsInternalResult(payload: Record<string, unknown>): boolean {
  const results: unknown[] = Array.isArray(payload.results)
    ? payload.results as unknown[]
    : [];
  const candidates: unknown[] = [payload.match, ...results];
  return candidates.some((item) =>
    typeof item === 'object' &&
    item !== null &&
    'visibility' in item &&
    (item as { visibility?: unknown }).visibility === 'internal',
  );
}

function formatToolError(tool: string, error: unknown): string {
  if (error instanceof InvalidCursorError) {
    return `${tool} rejected the cursor because it is invalid, stale, or belongs to different filters. Retry without cursor to start a fresh page.`;
  }
  if (error instanceof ZodError) {
    const issues = error.issues.slice(0, 5).map((issue) =>
      `${issue.path.join('.') || 'input'}: ${issue.message}`,
    );
    return `${tool} rejected the request: ${issues.join('; ')}. Correct these fields and retry.`;
  }
  return `${tool} could not complete because the catalog service failed. Retry the request; if it persists, check /ready and /stats.`;
}

function hasZeroResults(payload: Record<string, unknown>): boolean {
  for (const key of ['results', 'capabilities', 'bestDocs', 'recommendedDocs']) {
    if (Array.isArray(payload[key])) return payload[key].length === 0;
  }
  return payload.status === 'not-found' || payload.supported === false;
}
