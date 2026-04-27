import type { DocumentChunk } from '@revogrid-mcp/content-model';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { keywordSearch } from './keywordSearch.js';
import type { SearchIntent } from './queryAnalysis.js';
import { rerankMatches } from './rerank.js';
import { vectorSearch } from './vectorSearch.js';

export function hybridSearch(
  query: string,
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
  searchIntent: SearchIntent = 'docs',
): SearchMatch[] {
  const candidateFilters = {
    ...filters,
    limit: Math.max(filters.limit * 8, 40)
  };
  const keywordMatches = keywordSearch(query, chunks, candidateFilters, searchIntent);
  const semanticMatches = vectorSearch(query, chunks, candidateFilters, searchIntent);

  return rerankMatches(keywordMatches, semanticMatches, filters.limit);
}
