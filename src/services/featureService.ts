import type {
  DocumentChunk,
  Entitlement,
  Framework
} from '@revogrid-mcp/content-model';
import { normalizeText } from '@revogrid-mcp/shared';

import type { ContentRepository } from '../repositories/contentRepository.js';
import { filterChunks } from '../retrieval/keywordSearch.js';
import type { FeatureMatrixService, FeatureResolution } from '../types/catalog.js';
import type { SearchMatch, SearchQueryFilters } from '../types/catalog.js';

export class DefaultFeatureMatrixService implements FeatureMatrixService {
  public constructor(private readonly repository: ContentRepository) {}

  public async listFeatures(entitlement: Entitlement) {
    const features = await this.repository.getFeatures();
    if (entitlement === 'paid_pro') {
      return features;
    }

    return features.filter((feature) => !feature.requiresPro);
  }

  public async resolveFeature(
    featureName: string,
    options: {
      framework?: Framework | undefined;
      version?: string | undefined;
      entitlement: Entitlement;
    },
  ): Promise<FeatureResolution> {
    const [features, chunks] = await Promise.all([
      this.repository.getFeatures(),
      this.repository.getChunks()
    ]);
    const normalizedName = normalizeText(featureName);

    const feature =
      features.find((candidate) => normalizeText(candidate.featureName) === normalizedName) ??
      features.find((candidate) =>
        candidate.aliases.some((alias) => normalizeText(alias) === normalizedName),
      ) ??
      null;

    const filters = {
      framework: options.framework,
      version: options.version,
      limit: 8,
      entitlement: options.entitlement
    };

    if (feature) {
      return {
        feature,
        docs: this.buildMatchesFromIds(
          chunks,
          feature.relatedChunkIds,
          filters,
          'feature metadata',
        ),
        examples: this.buildMatchesFromIds(
          chunks,
          feature.relatedExampleIds,
          filters,
          'feature metadata',
        )
      };
    }

    const fallback = this.resolveFeatureFromSearch(featureName, chunks, filters);
    if (!fallback) {
      return {
        feature: null,
        docs: [],
        examples: []
      };
    }

    return fallback;
  }

  private buildMatchesFromIds(
    chunks: DocumentChunk[],
    ids: string[],
    filters: SearchQueryFilters,
    whyMatched: string,
  ): SearchMatch[] {
    if (ids.length === 0) {
      return [];
    }

    const idsSet = new Set(ids);
    return filterChunks(
      chunks.filter((chunk) => idsSet.has(chunk.id)),
      { ...filters, limit: Math.max(ids.length, filters.limit) },
    )
      .map((chunk, index) => ({
        chunk,
        score: Number((10 - index * 0.25).toFixed(3)),
        whyMatched
      }))
      .slice(0, filters.limit);
  }

  private resolveFeatureFromSearch(
    featureName: string,
    chunks: DocumentChunk[],
    filters: SearchQueryFilters,
  ): FeatureResolution | null {
    const normalizedName = normalizeText(featureName);
    const candidates = filterChunksForMetadata(chunks, filters)
      .map((chunk) => ({
        chunk,
        evidence: getFeatureEvidenceScore(normalizedName, chunk)
      }))
      .filter((candidate) => candidate.evidence >= 5)
      .sort((left, right) => right.evidence - left.evidence);

    if (candidates.length === 0) {
      return null;
    }

    const matchedChunks = candidates.map((candidate) => candidate.chunk);
    const bestChunk = candidates[0]?.chunk;
    const relatedDocIds = matchedChunks
      .filter((chunk) => chunk.docType !== 'example' && chunk.docType !== 'live-demo')
      .map((chunk) => chunk.id);
    const relatedExampleIds = matchedChunks
      .filter((chunk) => chunk.docType === 'example' || chunk.docType === 'live-demo')
      .map((chunk) => chunk.id);
    const requiresPro = matchedChunks.every((chunk) => chunk.requiresPro);

    return {
      feature: {
        featureName: bestChunk ? inferFeatureDisplayName(featureName, normalizedName, bestChunk) : featureName,
        supported: true,
        requiresPro,
        stability: bestChunk?.stability,
        supportedFrameworks: inferSupportedFrameworks(matchedChunks),
        notes: matchedChunks
          .map((chunk) => chunk.summary)
          .filter((summary): summary is string => Boolean(summary))
          .slice(0, 4),
        relatedChunkIds: relatedDocIds,
        relatedExampleIds,
        fallbackApproach: requiresPro
          ? 'Search public RevoGrid core docs for adjacent patterns if Pro access is unavailable.'
          : undefined,
        aliases: [normalizedName]
      },
      docs: this.buildMatchesFromIds(chunks, relatedDocIds, filters, 'search metadata fallback'),
      examples: this.buildMatchesFromIds(chunks, relatedExampleIds, filters, 'search metadata fallback')
    };
  }
}

function getFeatureEvidenceScore(query: string, chunk: DocumentChunk): number {
  let score = 0;
  const normalizedTitle = normalizeText(chunk.title);
  const normalizedPath = normalizeText(chunk.sourcePath ?? '');

  if (normalizedTitle === query) {
    score += 8;
  } else if (normalizedTitle.includes(query)) {
    score += 6;
  }

  for (const symbol of chunk.symbols) {
    const normalizedSymbol = normalizeText(symbol);
    if (normalizedSymbol === query) {
      score += 10;
      break;
    }

    if (normalizedSymbol.includes(query) || query.includes(normalizedSymbol)) {
      score += 7;
    }
  }

  if (normalizedPath.includes(query)) {
    score += 4;
  }

  return score;
}

function inferFeatureDisplayName(
  requestedName: string,
  normalizedName: string,
  chunk: DocumentChunk,
): string {
  const exactSymbol = chunk.symbols.find((symbol) => normalizeText(symbol) === normalizedName);
  if (exactSymbol) {
    return exactSymbol;
  }

  if (normalizeText(chunk.title) === normalizedName) {
    return chunk.title;
  }

  return requestedName;
}

function inferSupportedFrameworks(chunks: DocumentChunk[]): Framework[] {
  const frameworks = new Set<Framework>();

  for (const chunk of chunks) {
    frameworks.add(chunk.framework ?? 'vanilla');
  }

  return [...frameworks];
}

function filterChunksForMetadata(
  chunks: DocumentChunk[],
  filters: SearchQueryFilters,
): DocumentChunk[] {
  return chunks.filter((chunk) => {
    if (filters.framework && chunk.framework && chunk.framework !== filters.framework) {
      return false;
    }

    if (filters.version && chunk.version && normalizeText(chunk.version) !== normalizeText(filters.version)) {
      return false;
    }

    return true;
  });
}
