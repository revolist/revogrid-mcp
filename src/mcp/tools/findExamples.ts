import {
  FindExamplesInputSchema,
  FindExamplesOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../../types/catalog.js';
import { formatExampleResult } from '../../services/resultFormatting.js';
import { filterVisibleMatches } from './shared.js';

export async function handleFindExamples(
  rawInput: unknown,
  services: AppServices,
  context: RequestContext,
) {
  const input = FindExamplesInputSchema.parse(rawInput);
  const results = await services.searchService.findExamples(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    limit: input.limit,
    entitlement: context.entitlement
  });

  return FindExamplesOutputSchema.parse({
    results: filterVisibleMatches(results, context).map(formatExampleResult)
  });
}
