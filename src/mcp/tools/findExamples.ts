import {
  FindExamplesInputSchema,
  FindExamplesOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { decodePageCursor, encodePageCursor } from '../../services/pagination.js';
import { formatExampleResult } from '../../services/resultFormatting.js';

export async function handleFindExamples(
  rawInput: unknown,
  services: AppServices,
) {
  const input = FindExamplesInputSchema.parse(rawInput);
  const cursorContext = {
    query: input.query,
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    product: input.product,
    packageName: input.packageName,
    snapshot: (await services.contentRepository.getSnapshot())?.generatedAt
  };
  const offset = decodePageCursor(input.cursor, 'find_examples', cursorContext);
  const results = await services.searchService.findExamples(input.query, {
    framework: input.framework,
    version: input.version,
    surface: input.surface,
    requiresPro: input.requiresPro,
    product: input.product,
    packageName: input.packageName,
    limit: offset + input.limit + 1
  });

  return FindExamplesOutputSchema.parse({
    results: results.slice(offset, offset + input.limit).map(formatExampleResult),
    nextCursor: results.length > offset + input.limit
      ? encodePageCursor(offset + input.limit, 'find_examples', cursorContext)
      : undefined
  });
}
