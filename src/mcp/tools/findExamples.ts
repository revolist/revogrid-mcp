import {
  FindExamplesInputSchema,
  FindExamplesOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { formatExampleResult } from '../../services/resultFormatting.js';

export async function handleFindExamples(
  rawInput: unknown,
  services: AppServices,
) {
  const input = FindExamplesInputSchema.parse(rawInput);
  const results = await services.searchService.findExamples(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    limit: input.limit
  });

  return FindExamplesOutputSchema.parse({
    results: results.map(formatExampleResult)
  });
}
