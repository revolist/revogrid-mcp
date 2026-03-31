import type {
  DocumentChunk,
  Entitlement,
  FeatureRecord,
  Framework,
  MigrationNoteRecord
} from '@revogrid-mcp/content-model';
import type { ContentRepository } from '../repositories/contentRepository.js';

export type RequestContext = {
  entitlement: Entitlement;
};

export type SearchMatch = {
  chunk: DocumentChunk;
  score: number;
  whyMatched: string;
};

export type AppServices = {
  contentRepository: ContentRepository;
  searchService: RevogridSearchService;
  featureService: FeatureMatrixService;
  migrationService: MigrationService;
};

export type SearchQueryFilters = {
  framework?: Framework | undefined;
  version?: string | undefined;
  surface?: DocumentChunk['surface'] | undefined;
  requiresPro?: boolean | undefined;
  docTypes?: DocumentChunk['docType'][] | undefined;
  limit: number;
  entitlement: Entitlement;
};

export type RevogridSearchService = {
  searchDocs: (query: string, filters: SearchQueryFilters) => Promise<SearchMatch[]>;
  findExamples: (query: string, filters: SearchQueryFilters) => Promise<SearchMatch[]>;
};

export type FeatureResolution = {
  feature: FeatureRecord | null;
  docs: SearchMatch[];
  examples: SearchMatch[];
};

export type FeatureMatrixService = {
  listFeatures: (entitlement: Entitlement) => Promise<FeatureRecord[]>;
  resolveFeature: (
    featureName: string,
    options: {
      framework?: Framework | undefined;
      version?: string | undefined;
      entitlement: Entitlement;
    },
  ) => Promise<FeatureResolution>;
};

export type MigrationResolution = {
  migration: MigrationNoteRecord | null;
  docs: SearchMatch[];
  examples: SearchMatch[];
};

export type MigrationService = {
  resolveMigration: (
    fromVersion: string,
    toVersion: string,
    options: {
      framework?: Framework | undefined;
      entitlement: Entitlement;
    },
  ) => Promise<MigrationResolution>;
};
