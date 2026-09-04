import type {
  CapabilityRecord,
  CapabilitySummary,
  CatalogSnapshot,
  DocumentChunk,
  FeatureRecord,
  Framework,
  MigrationNoteRecord,
  PackageRecord,
  Product,
  Stability,
  SymbolKind,
  Tier,
  Visibility
} from '@revogrid-mcp/content-model';
import type { ContentRepository } from '../repositories/contentRepository.js';

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
  developerService: DeveloperCopilotService;
};

export type SearchQueryFilters = {
  framework?: Framework | undefined;
  version?: string | undefined;
  surface?: DocumentChunk['surface'] | undefined;
  requiresPro?: boolean | undefined;
  docTypes?: DocumentChunk['docType'][] | undefined;
  product?: Product | undefined;
  packageName?: string | undefined;
  visibility?: Visibility | undefined;
  symbolKind?: SymbolKind | undefined;
  limit: number;
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
  listFeatures: () => Promise<FeatureRecord[]>;
  resolveFeature: (
    featureName: string,
    options: {
      framework?: Framework | undefined;
      version?: string | undefined;
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
    },
  ) => Promise<MigrationResolution>;
};

export type CapabilityFilters = {
  product?: Product | undefined;
  packageName?: string | undefined;
  framework?: Framework | undefined;
  version?: string | undefined;
  stability?: Stability | undefined;
  tier?: Tier | undefined;
  cursor?: string | undefined;
  limit: number;
};

export type DeveloperCopilotService = {
  listCapabilities: (filters: CapabilityFilters) => Promise<{ results: CapabilitySummary[]; nextCursor?: string }>;
  inspectApi: (query: string, options: { packageName?: string | undefined; framework?: Framework | undefined; version?: string | undefined; includeInternal?: boolean | undefined }) => Promise<{ match?: CapabilityRecord | undefined; candidates: CapabilityRecord[] }>;
  planImplementation: (input: { objective: string; capabilities: string[]; framework: Framework; installedVersions?: Record<string, string> | undefined; targetVersions?: Record<string, string> | undefined; constraints?: string[] | undefined }) => Promise<Record<string, unknown>>;
  validateUsage: (input: { framework?: Framework | undefined; imports: Array<{ packageName: string; symbols: string[] }>; features?: string[] | undefined; configuration?: Array<{ capability: string; packageName?: string | undefined; keys: string[] }> | undefined; installedVersions?: Record<string, string> | undefined; sourceSnippet?: string | undefined }) => Promise<{ valid: boolean; diagnostics: Array<Record<string, unknown>> }>;
  getCapability: (id: string) => Promise<CapabilityRecord | null>;
  getPackage: (name: string) => Promise<PackageRecord | null>;
  getExample: (id: string) => Promise<DocumentChunk | null>;
  getSnapshot: () => Promise<CatalogSnapshot | null>;
};
