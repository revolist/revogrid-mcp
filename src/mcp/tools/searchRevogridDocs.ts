import {
  SearchRevogridDocsInputSchema,
  SearchRevogridDocsOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { formatSearchResult } from '../../services/resultFormatting.js';

export async function handleSearchRevogridDocs(
  rawInput: unknown,
  services: AppServices,
) {
  const input = SearchRevogridDocsInputSchema.parse(rawInput);
  const results = await services.searchService.searchDocs(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    docTypes: input.docTypes,
    limit: input.limit
  });

  const output = SearchRevogridDocsOutputSchema.parse({
    query: input.query,
    appliedFilters: {
      framework: input.framework,
      version: input.version,
      surface: input.surface,
      requiresPro: input.requiresPro,
      docTypes: input.docTypes,
      limit: input.limit
    },
    results: results.map(formatSearchResult),
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

  return undefined;
}
