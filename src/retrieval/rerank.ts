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
