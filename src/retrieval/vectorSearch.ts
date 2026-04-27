import type { DocumentChunk } from '@revogrid-mcp/content-model';
import { embedChunks } from '@revogrid-mcp/ingestion';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { filterChunks } from './keywordSearch.js';
import { analyzeQuery, scoreIntentBoost, type SearchIntent, tokenizeForSearch } from './queryAnalysis.js';
import { compareSearchMatches } from './rerank.js';

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function vectorSearch(
  query: string,
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
  searchIntent: SearchIntent = 'docs',
): SearchMatch[] {
  const scopedChunks = filterChunks(chunks, filters);
  const analysis = analyzeQuery(query, searchIntent);
  const queryChunk: DocumentChunk = {
    id: 'query',
    title: query,
    body: query,
    summary: query,
    surface: filters.surface ?? 'core',
    docType: 'guide',
    requiresPro: false,
    symbols: tokenizeForSearch(query),
    framework: filters.framework,
    version: filters.version,
    url: 'https://rv-grid.com/search/query'
  };

  const queryVector = embedChunks([queryChunk])[0]?.vector ?? [];
  const embeddedChunks = embedChunks(scopedChunks);
  const chunkMap = new Map(scopedChunks.map((chunk) => [chunk.id, chunk]));

  return embeddedChunks
    .map((embeddedChunk) => {
      const chunk = chunkMap.get(embeddedChunk.chunkId);
      if (!chunk) {
        return null;
      }

      const score = cosineSimilarity(queryVector, embeddedChunk.vector);
      const intentBoost = scoreIntentBoost(chunk, analysis, filters);

      return {
        chunk,
        score: score + intentBoost.score / 20,
        whyMatched: ['semantic similarity', ...intentBoost.reasons].join('; ')
      };
    })
    .filter((match): match is SearchMatch => Boolean(match && match.score > 0))
    .sort(compareSearchMatches)
    .slice(0, filters.limit);
}
