import type { SearchMatch } from '../types/catalog.js';

export function compareSearchMatches(left: SearchMatch, right: SearchMatch): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const titleComparison = left.chunk.title.localeCompare(right.chunk.title);
  if (titleComparison !== 0) {
    return titleComparison;
  }

  return left.chunk.id.localeCompare(right.chunk.id);
}

export function rerankMatches(
  keywordMatches: SearchMatch[],
  vectorMatches: SearchMatch[],
  limit: number,
): SearchMatch[] {
  const merged = new Map<string, SearchMatch>();

  for (const match of [...keywordMatches, ...vectorMatches]) {
    const existing = merged.get(match.chunk.id);

    if (!existing) {
      merged.set(match.chunk.id, match);
      continue;
    }

    merged.set(match.chunk.id, {
      ...match,
      score: existing.score + match.score,
      whyMatched: [...new Set([existing.whyMatched, match.whyMatched])].join('; ')
    });
  }

  return [...merged.values()].sort(compareSearchMatches).slice(0, limit);
}
