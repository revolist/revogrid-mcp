import type { DocumentChunk } from '@revogrid-mcp/content-model';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { keywordSearch } from './keywordSearch.js';
import type { SearchIntent } from './queryAnalysis.js';

export function hybridSearch(
  query: string,
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
  searchIntent: SearchIntent = 'docs',
): SearchMatch[] {
  return keywordSearch(query, chunks, filters, searchIntent);
}
