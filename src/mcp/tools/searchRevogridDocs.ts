import {
  SearchRevogridDocsInputSchema,
  SearchRevogridDocsOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../../types/catalog.js';
import { formatSearchResult } from '../../services/resultFormatting.js';
import { filterVisibleMatches } from './shared.js';

export async function handleSearchRevogridDocs(
  rawInput: unknown,
  services: AppServices,
  context: RequestContext,
) {
  const input = SearchRevogridDocsInputSchema.parse(rawInput);
  const results = await services.searchService.searchDocs(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    docTypes: input.docTypes,
    limit: input.limit,
    entitlement: context.entitlement
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
    results: filterVisibleMatches(results, context).map(formatSearchResult),
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
