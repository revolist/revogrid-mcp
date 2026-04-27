import type { DocumentChunk } from '@revogrid-mcp/content-model';
import { normalizeText, unique } from '@revogrid-mcp/shared';

import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';

export type SearchIntent = 'docs' | 'examples';

export type QueryAnalysis = {
  normalized: string;
  tokens: string[];
  originalTokens: string[];
  phraseTokens: string[];
  requestedFramework?: DocumentChunk['framework'] | undefined;
  wantsExamples: boolean;
  wantsApi: boolean;
  wantsSetup: boolean;
  wantsEvent: boolean;
  searchIntent: SearchIntent;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'for',
  'from',
  'grid',
  'how',
  'in',
  'is',
  'of',
  'on',
  'revo',
  'revogrid',
  'table',
  'the',
  'to',
  'use',
  'with',
  'your'
]);

const FRAMEWORKS = ['react', 'vue', 'angular', 'svelte', 'vanilla'] as const;

const TOKEN_ALIASES: Record<string, string[]> = {
  excel: ['xlsx', 'spreadsheet'],
  export: ['exporting', 'download'],
  exporting: ['export'],
  infinite: ['infinity'],
  infinity: ['infinite'],
  install: ['setup', 'getting', 'started'],
  installing: ['install', 'setup'],
  setup: ['install', 'getting', 'started'],
  start: ['started', 'setup'],
  started: ['getting', 'setup']
};

export function analyzeQuery(query: string, searchIntent: SearchIntent = 'docs'): QueryAnalysis {
  const normalized = normalizeForSearch(query);
  const originalTokens = tokenizeForSearch(query).filter((token) => !STOP_WORDS.has(token));
  const tokens = expandTokens(originalTokens);
  const requestedFramework = FRAMEWORKS.find((framework) => tokens.includes(framework));
  const wantsExamples = tokens.some((token) => token === 'example' || token === 'examples' || token === 'demo');
  const wantsApi = tokens.some((token) => token === 'api' || token === 'type' || token === 'types' || token === 'interface');
  const wantsSetup = tokens.some((token) => token === 'setup' || token === 'install' || token === 'started' || token === 'getting');
  const wantsEvent = tokens.some((token) => token === 'event' || token === 'events' || token.endsWith('event'));

  return {
    normalized,
    tokens,
    originalTokens,
    phraseTokens: originalTokens.length > 0 ? originalTokens : tokens,
    requestedFramework,
    wantsExamples,
    wantsApi,
    wantsSetup,
    wantsEvent,
    searchIntent
  };
}

export function tokenizeForSearch(value: string): string[] {
  return unique(
    normalizeForSearch(value)
      .split(/[^a-z0-9@.-]+/i)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function normalizeForSearch(value: string): string {
  return normalizeText(splitIdentifierWords(value))
    .replace(/[_./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreIntentBoost(
  chunk: DocumentChunk,
  analysis: QueryAnalysis,
  filters: SearchQueryFilters,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (analysis.searchIntent === 'examples') {
    if (isExampleChunk(chunk)) {
      score += 12;
      reasons.push('example intent');
    }
  } else if (analysis.wantsExamples) {
    if (isExampleChunk(chunk)) {
      score += 8;
      reasons.push('example query');
    }
  } else if (analysis.wantsApi || analysis.wantsEvent || hasExactSymbolMatch(chunk, analysis)) {
    if (chunk.docType === 'api') {
      score += 8;
      reasons.push('api intent');
    } else if (chunk.docType === 'guide') {
      score += 2;
    } else if (isExampleChunk(chunk)) {
      score -= 8;
    }
  } else {
    if (chunk.docType === 'guide') {
      score += 18;
      reasons.push('guide intent');
    } else if (chunk.docType === 'api') {
      score -= 2;
    } else if (isExampleChunk(chunk)) {
      score -= 14;
    }
  }

  if (analysis.requestedFramework) {
    if (chunk.framework === analysis.requestedFramework) {
      score += 8;
      reasons.push(`framework:${analysis.requestedFramework}`);
    } else if (chunk.framework && chunk.framework !== analysis.requestedFramework) {
      score -= 8;
    }
  } else if (filters.framework) {
    if (chunk.framework === filters.framework) {
      score += 4;
    }
  }

  if (analysis.wantsSetup) {
    const title = normalizeForSearch(chunk.title);
    const sourcePath = normalizeForSearch(chunk.sourcePath ?? '');
    if (
      title.includes('getting started') ||
      title.includes('installation') ||
      sourcePath.includes('getting started') ||
      sourcePath.includes(`${analysis.requestedFramework ?? filters.framework ?? ''} index`)
    ) {
      score += 8;
      reasons.push('setup intent');
    }
  }

  return { score, reasons };
}

export function dedupeMatches(matches: SearchMatch[], limit: number): SearchMatch[] {
  const winners = new Map<string, SearchMatch>();

  for (const match of matches) {
    const keys = getDedupeKeys(match.chunk);
    const existing = keys.map((key) => winners.get(key)).find(Boolean);

    if (!existing) {
      for (const key of keys) {
        winners.set(key, match);
      }
      continue;
    }

    if (compareMatchForDedupe(match, existing) < 0) {
      for (const key of keys) {
        winners.set(key, match);
      }
    }
  }

  return unique([...winners.values()]).slice(0, limit);
}

export function hasExactSymbolMatch(chunk: DocumentChunk, analysis: QueryAnalysis): boolean {
  if (analysis.normalized.includes(' ')) {
    return false;
  }

  const queryCompacts = new Set([
    analysis.normalized.replace(/\s+/g, ''),
    ...analysis.originalTokens.filter((token) => token.length >= 5)
  ]);
  return chunk.symbols.some((symbol) => {
    const compactSymbol = normalizeForSearch(symbol).replace(/\s+/g, '');
    return compactSymbol.length >= 5 && queryCompacts.has(compactSymbol);
  });
}

function expandTokens(tokens: string[]): string[] {
  const expanded = tokens.flatMap((token) => [token, ...(TOKEN_ALIASES[token] ?? [])]);
  return unique(expanded).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function splitIdentifierWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function getDedupeKeys(chunk: DocumentChunk): string[] {
  const titleKey = normalizeForSearch(chunk.title)
    .replace(/\b(react|vue|angular|svelte|javascript|js|data|grid|table|component|demo|example)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const urlKey = chunk.url.replace(/\/$/, '').replace(/\/(index|README)$/i, '');
  const sourceKey = (chunk.sourcePath ?? '')
    .replace(/\.(md|mdx|ts|tsx|js|jsx|vue|svelte|astro)$/i, '')
    .replace(/\/(index|README)$/i, '');

  return unique([
    titleKey ? `title:${titleKey}` : '',
    `url:${urlKey}`,
    sourceKey ? `source:${sourceKey}` : ''
  ].filter(Boolean));
}

function compareMatchForDedupe(left: SearchMatch, right: SearchMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.chunk.id.localeCompare(right.chunk.id);
}

function isExampleChunk(chunk: DocumentChunk): boolean {
  return chunk.docType === 'example' || chunk.docType === 'live-demo';
}
