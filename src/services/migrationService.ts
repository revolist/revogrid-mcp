import type {
  DocumentChunk,
  Entitlement,
  Framework,
  MigrationNoteRecord
} from '@revogrid-mcp/content-model';
import { normalizeVersion } from '@revogrid-mcp/content-model';

import type { ContentRepository } from '../repositories/contentRepository.js';
import { filterChunks } from '../retrieval/keywordSearch.js';
import type {
  MigrationResolution,
  MigrationService
} from '../types/catalog.js';
import type { SearchMatch } from '../types/catalog.js';

export class DefaultMigrationService implements MigrationService {
  public constructor(private readonly repository: ContentRepository) {}

  public async resolveMigration(
    fromVersion: string,
    toVersion: string,
    options: {
      framework?: Framework | undefined;
      entitlement: Entitlement;
    },
  ): Promise<MigrationResolution> {
    const [migrations, chunks] = await Promise.all([
      this.repository.getMigrations(),
      this.repository.getChunks()
    ]);
    const source = normalizeVersion(fromVersion);
    const target = normalizeVersion(toVersion);

    const migration =
      migrations.find(
        (candidate) =>
          normalizeVersion(candidate.fromVersion) === source &&
          normalizeVersion(candidate.toVersion) === target &&
          frameworkMatches(candidate.framework, options.framework),
      ) ?? null;

    const resolvedMigration =
      migration ??
      selectClosestMigration(migrations, fromVersion, toVersion, options.framework);

    if (!resolvedMigration) {
      return {
        migration: null,
        docs: [],
        examples: []
      };
    }

    const filters = {
      framework: options.framework,
      limit: 5,
      entitlement: options.entitlement
    };

    return {
      migration: resolvedMigration,
      docs: buildMatchesFromIds(
        chunks,
        resolvedMigration.recommendedDocIds,
        filters,
        'migration metadata',
      ),
      examples: buildMatchesFromIds(
        chunks,
        resolvedMigration.recommendedExampleIds,
        filters,
        'migration metadata',
      )
    };
  }
}

function buildMatchesFromIds(
  chunks: DocumentChunk[],
  ids: string[],
  filters: {
    framework?: Framework | undefined;
    limit: number;
    entitlement: Entitlement;
  },
  whyMatched: string,
): SearchMatch[] {
  if (ids.length === 0) {
    return [];
  }

  const idsSet = new Set(ids);
  return filterChunks(
    chunks.filter((chunk) => idsSet.has(chunk.id)),
    { ...filters, version: undefined },
  )
    .map((chunk, index) => ({
      chunk,
      score: Number((10 - index * 0.25).toFixed(3)),
      whyMatched
    }))
    .slice(0, filters.limit);
}

function selectClosestMigration(
  migrations: MigrationNoteRecord[],
  fromVersion: string,
  toVersion: string,
  framework?: Framework,
): MigrationNoteRecord | null {
  const ranked = migrations
    .filter((candidate) => frameworkMatches(candidate.framework, framework))
    .map((candidate) => ({
      candidate,
      score: getMigrationCompatibilityScore(candidate, fromVersion, toVersion)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.candidate ?? null;
}

function getMigrationCompatibilityScore(
  candidate: MigrationNoteRecord,
  fromVersion: string,
  toVersion: string,
): number {
  const fromScore = getVersionCompatibilityScore(candidate.fromVersion, fromVersion);
  const toScore = getVersionCompatibilityScore(candidate.toVersion, toVersion);

  if (fromScore === 0 && toScore === 0) {
    return 0;
  }

  return fromScore * 10 + toScore;
}

function frameworkMatches(
  candidateFramework: Framework | undefined,
  requestedFramework: Framework | undefined,
): boolean {
  if (!requestedFramework) {
    return true;
  }

  return !candidateFramework || candidateFramework === requestedFramework;
}

function getVersionCompatibilityScore(candidateVersion: string, requestedVersion: string): number {
  const normalizedCandidate = normalizeVersion(candidateVersion);
  const normalizedRequested = normalizeVersion(requestedVersion);

  if (!normalizedCandidate || !normalizedRequested) {
    return 0;
  }

  if (normalizedCandidate === normalizedRequested) {
    return 5;
  }

  const candidateMajor = extractMajorVersion(normalizedCandidate);
  const requestedMajor = extractMajorVersion(normalizedRequested);

  if (candidateMajor !== null && requestedMajor !== null && candidateMajor === requestedMajor) {
    return normalizedCandidate.includes('x') || normalizedRequested.includes('x') ? 4 : 3;
  }

  return 0;
}

function extractMajorVersion(version: string): number | null {
  const match = version.match(/^(\d+)/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
