import {
  SearchRevogridDocsInputSchema,
  SearchRevogridDocsOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { decodePageCursor, encodePageCursor } from '../../services/pagination.js';
import { formatSearchResult } from '../../services/resultFormatting.js';

export async function handleSearchRevogridDocs(
  rawInput: unknown,
  services: AppServices,
) {
  const input = SearchRevogridDocsInputSchema.parse(rawInput);
  const cursorContext = {
    query: input.query,
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    docTypes: input.docTypes,
    product: input.product,
    packageName: input.packageName,
    visibility: input.visibility,
    symbolKind: input.symbolKind,
    snapshot: (await services.contentRepository.getSnapshot())?.generatedAt
  };
  const offset = decodePageCursor(input.cursor, 'search_revogrid_docs', cursorContext);
  const results = await services.searchService.searchDocs(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    docTypes: input.docTypes,
    product: input.product,
    packageName: input.packageName,
    visibility: input.visibility,
    symbolKind: input.symbolKind,
    limit: offset + input.limit + 1
  });
  const page = results.slice(offset, offset + input.limit);

  const output = SearchRevogridDocsOutputSchema.parse({
    query: input.query,
    appliedFilters: {
      framework: input.framework,
      version: input.version,
      surface: input.surface,
      requiresPro: input.requiresPro,
      docTypes: input.docTypes,
      product: input.product,
      packageName: input.packageName,
      visibility: input.visibility,
      symbolKind: input.symbolKind,
      cursor: input.cursor,
      limit: input.limit
    },
    results: page.map(formatSearchResult),
    nextCursor: results.length > offset + input.limit
      ? encodePageCursor(offset + input.limit, 'search_revogrid_docs', cursorContext)
      : undefined,
    suggestedNextTool: inferSuggestedNextTool(input.query)
  });

  return output;
}

function inferSuggestedNextTool(query: string): string | undefined {
  const normalized = query.toLowerCase();

  if (normalized.includes('example') || normalized.includes('demo')) {
    return 'find_examples';
  }

  if (normalized.includes('upgrade') || normalized.includes('migration')) {
    return 'get_migration_notes';
  }

  if (normalized.includes('feature') || normalized.includes('supports')) {
    return 'resolve_feature_matrix';
  }

  return normalized.split(/\s+/).length <= 3 ? 'inspect_revogrid_api' : undefined;
}
