import type { DocumentChunk } from '@revogrid-mcp/content-model';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { keywordSearch } from './keywordSearch.js';
import { rerankMatches } from './rerank.js';
import { vectorSearch } from './vectorSearch.js';

export function hybridSearch(
  query: string,
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
): SearchMatch[] {
  const keywordMatches = keywordSearch(query, chunks, filters);
  const semanticMatches = vectorSearch(query, chunks, filters);

  return rerankMatches(keywordMatches, semanticMatches, filters.limit);
}
