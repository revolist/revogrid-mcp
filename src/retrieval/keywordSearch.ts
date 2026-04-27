import type { DocumentChunk } from '@revogrid-mcp/content-model';
import { canAccessChunk, normalizeVersion } from '@revogrid-mcp/content-model';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';
import { compareSearchMatches } from './rerank.js';
import {
  analyzeQuery,
  normalizeForSearch,
  scoreIntentBoost,
  type SearchIntent,
  tokenizeForSearch
} from './queryAnalysis.js';

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
  searchIntent: SearchIntent = 'docs',
): SearchMatch[] {
  const scopedChunks = filterChunks(chunks, filters);
  const analysis = analyzeQuery(query, searchIntent);

  return scopedChunks
    .map((chunk) => {
      const title = normalizeForSearch(chunk.title);
      const summary = normalizeForSearch(chunk.summary ?? '');
      const body = normalizeForSearch(chunk.body);
      const sourcePath = normalizeForSearch(chunk.sourcePath ?? '');
      const symbolTokens = new Set(chunk.symbols.flatMap((symbol) => tokenizeForSearch(symbol)));
      const haystack = normalizeForSearch(
        `${chunk.title} ${chunk.summary ?? ''} ${chunk.body} ${chunk.symbols.join(' ')}`,
      );

      let score = 0;
      const reasons = new Set<string>();

      if (analysis.normalized && haystack.includes(analysis.normalized)) {
        score += 10;
        reasons.add('full query match');
      }

      for (const token of analysis.tokens) {
        if (title.includes(token)) {
          score += 6;
          reasons.add(`title:${token}`);
        }

        if (symbolTokens.has(token)) {
          score += 8;
          reasons.add(`symbol:${token}`);
        }

        if (summary.includes(token)) {
          score += 3;
        }

        if (sourcePath.includes(token)) {
          score += 2;
        }

        if (body.includes(token)) {
          score += 1;
        }
      }

      const requiredTokensMatched = analysis.phraseTokens.filter(
        (token) => title.includes(token) || symbolTokens.has(token) || summary.includes(token) || sourcePath.includes(token),
      ).length;
      if (analysis.phraseTokens.length > 1 && requiredTokensMatched === analysis.phraseTokens.length) {
        score += 8;
        reasons.add('all key tokens');
      }

      const intentBoost = scoreIntentBoost(chunk, analysis, filters);
      score += intentBoost.score;
      for (const reason of intentBoost.reasons) {
        reasons.add(reason);
      }

      if (searchIntent === 'docs' && !analysis.wantsExamples && isExampleChunk(chunk)) {
        score = Math.min(score, 48);
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

function isExampleChunk(chunk: DocumentChunk): boolean {
  return chunk.docType === 'example' || chunk.docType === 'live-demo';
}
