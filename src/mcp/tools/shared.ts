import { canAccessChunk } from '@revogrid-mcp/content-model';

import type { RequestContext, SearchMatch } from '../../types/catalog.js';

export function filterVisibleMatches(
  matches: SearchMatch[],
  context: RequestContext,
): SearchMatch[] {
  return matches.filter((match) => canAccessChunk(match.chunk, context.entitlement));
}
