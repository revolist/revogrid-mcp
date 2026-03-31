import type {
  ExampleResultItem,
  SearchResultItem
} from '@revogrid-mcp/content-model';

import type { SearchMatch } from '../types/catalog.js';

export function formatSearchResult(match: SearchMatch): SearchResultItem {
  return {
    id: match.chunk.id,
    title: match.chunk.title,
    summary: match.chunk.summary ?? match.chunk.body.slice(0, 160),
    framework: match.chunk.framework,
    version: match.chunk.version,
    surface: match.chunk.surface,
    docType: match.chunk.docType,
    requiresPro: match.chunk.requiresPro,
    symbols: match.chunk.symbols,
    score: Number(match.score.toFixed(3)),
    snippet: match.chunk.body.slice(0, 220),
    url: match.chunk.url,
    exampleUrl: match.chunk.exampleUrl,
    whyMatched: match.whyMatched
  };
}

export function formatExampleResult(match: SearchMatch): ExampleResultItem {
  return {
    id: match.chunk.id,
    title: match.chunk.title,
    framework: match.chunk.framework,
    version: match.chunk.version,
    surface: match.chunk.surface,
    summary: match.chunk.summary ?? match.chunk.body.slice(0, 160),
    packages: match.chunk.packageNames ?? [],
    sourceUrl: match.chunk.sourcePath ? `repo://${match.chunk.sourcePath}` : undefined,
    exampleUrl: match.chunk.exampleUrl,
    score: Number(match.score.toFixed(3))
  };
}
