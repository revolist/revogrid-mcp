import type { DocumentChunk } from '@revogrid-mcp/content-model';
import { canAccessChunk, normalizeVersion } from '@revogrid-mcp/content-model';
import { normalizeText, tokenize } from '@revogrid-mcp/shared';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { compareSearchMatches } from './rerank.js';

export function filterChunks(
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
): DocumentChunk[] {
  const targetVersion = normalizeVersion(filters.version);

  return chunks.filter((chunk) => {
    if (!canAccessChunk(chunk, filters.entitlement)) {
      return false;
    }

    if (filters.framework && chunk.framework && chunk.framework !== filters.framework) {
      return false;
    }

    if (filters.surface && chunk.surface !== filters.surface) {
      return false;
    }

    if (filters.requiresPro !== undefined && chunk.requiresPro !== filters.requiresPro) {
      return false;
    }

    if (filters.docTypes && !filters.docTypes.includes(chunk.docType)) {
      return false;
    }

    if (targetVersion && normalizeVersion(chunk.version) && normalizeVersion(chunk.version) !== targetVersion) {
      return false;
    }

    return true;
  });
}

export function keywordSearch(
  query: string,
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
): SearchMatch[] {
  const scopedChunks = filterChunks(chunks, filters);
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  return scopedChunks
    .map((chunk) => {
      const haystack = normalizeText(
        `${chunk.title} ${chunk.summary ?? ''} ${chunk.body} ${chunk.symbols.join(' ')}`,
      );

      let score = 0;
      const reasons = new Set<string>();

      if (haystack.includes(normalizedQuery)) {
        score += 6;
        reasons.add('full query match');
      }

      for (const token of queryTokens) {
        if (normalizeText(chunk.title).includes(token)) {
          score += 3;
          reasons.add(`title:${token}`);
        }

        if (chunk.symbols.some((symbol) => normalizeText(symbol).includes(token))) {
          score += 4;
          reasons.add(`symbol:${token}`);
        }

        if (haystack.includes(token)) {
          score += 1;
        }
      }

      return {
        chunk,
        score,
        whyMatched: reasons.size > 0 ? [...reasons].join(', ') : 'keyword overlap'
      };
    })
    .filter((match) => match.score > 0)
    .sort(compareSearchMatches)
    .slice(0, filters.limit);
}
