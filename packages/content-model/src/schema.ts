import { z } from 'zod';

import {
  DocTypeSchema,
  FrameworkSchema,
  ProductSchema,
  StabilitySchema,
  SurfaceSchema,
  SymbolKindSchema,
  TierSchema,
  VisibilitySchema
} from './enums.js';

export const EvidenceReferenceSchema = z.object({
  chunkId: z.string(),
  repository: z.enum(['revogrid', 'revogrid-pro']),
  revision: z.string().optional(),
  sourcePath: z.string().optional(),
  url: z.string().url(),
  authority: z.number().int().min(0).max(100)
});

export const CapabilityRelationSchema = z.object({
  type: z.enum(['dependsOn', 'conflictsWith', 'extends', 'configuredBy', 'demonstratedBy']),
  targetId: z.string()
});

export const DocumentChunkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  summary: z.string().optional(),
  framework: FrameworkSchema.optional(),
  surface: SurfaceSchema,
  docType: DocTypeSchema,
  version: z.string().optional(),
  requiresPro: z.boolean(),
  symbols: z.array(z.string()).default([]),
  stability: StabilitySchema.optional(),
  url: z.string().url(),
  sourcePath: z.string().optional(),
  exampleUrl: z.string().url().optional(),
  packageNames: z.array(z.string()).optional(),
  releaseDate: z.string().optional(),
  product: ProductSchema.optional(),
  packageName: z.string().optional(),
  packageVersion: z.string().optional(),
  visibility: VisibilitySchema.optional(),
  symbolKind: SymbolKindSchema.optional(),
  sourceRevision: z.string().optional(),
  signature: z.string().optional(),
  exportPath: z.string().optional(),
  authority: z.number().int().min(0).max(100).optional()
});

export const RetrievalFiltersSchema = z.object({
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema.optional(),
  requiresPro: z.boolean().optional(),
  docTypes: z.array(DocTypeSchema).optional(),
  product: ProductSchema.optional(),
  packageName: z.string().optional(),
  visibility: VisibilitySchema.optional(),
  symbolKind: SymbolKindSchema.optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export const PackageRecordSchema = z.object({
  name: z.string(),
  version: z.string(),
  product: ProductSchema,
  framework: FrameworkSchema.optional(),
  tier: TierSchema,
  requiresPro: z.boolean(),
  entrypoint: z.string(),
  exportEntrypoints: z.array(z.string()).default(['.']),
  dependencies: z.array(z.string()).default([]),
  peerDependencies: z.array(z.string()).default([]),
  sourceRevision: z.string().optional()
});

export const CapabilityRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  product: ProductSchema,
  packageName: z.string(),
  packageVersion: z.string(),
  tier: TierSchema,
  requiresPro: z.boolean(),
  visibility: VisibilitySchema,
  stability: StabilitySchema.default('stable'),
  frameworks: z.array(FrameworkSchema).default(['vanilla']),
  symbolKind: SymbolKindSchema.default('unknown'),
  exportPath: z.string().optional(),
  signature: z.string().optional(),
  configuration: z.array(z.string()).default([]),
  configurationKeys: z.array(z.string()).default([]),
  methods: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  peerDependencies: z.array(z.string()).default([]),
  relations: z.array(CapabilityRelationSchema).default([]),
  evidence: z.array(EvidenceReferenceSchema).default([]),
  relatedExampleIds: z.array(z.string()).default([])
});

export const CatalogSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.string(),
  sourceRevisions: z.record(z.string(), z.string()).default({}),
  packageCount: z.number().int().nonnegative(),
  capabilityCount: z.number().int().nonnegative(),
  publicExportCount: z.number().int().nonnegative(),
  exampleCount: z.number().int().nonnegative()
});

export const VersionRecordSchema = z.object({
  version: z.string(),
  label: z.string(),
  latest: z.boolean().default(false),
  releaseDate: z.string().optional(),
  surfaces: z.array(SurfaceSchema).default(['core'])
});

export const FeatureRecordSchema = z.object({
  featureName: z.string(),
  supported: z.boolean(),
  requiresPro: z.boolean(),
  stability: StabilitySchema.optional(),
  supportedFrameworks: z.array(FrameworkSchema).default([]),
  notes: z.array(z.string()).optional(),
  relatedChunkIds: z.array(z.string()).default([]),
  relatedExampleIds: z.array(z.string()).default([]),
  fallbackApproach: z.string().optional(),
  aliases: z.array(z.string()).default([])
});

export const MigrationNoteRecordSchema = z.object({
  id: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  framework: FrameworkSchema.optional(),
  breakingChanges: z.array(z.string()).default([]),
  renamedSymbols: z
    .array(
      z.object({
        from: z.string(),
        to: z.string()
      }),
    )
    .default([]),
  changedDefaults: z.array(z.string()).default([]),
  packageChanges: z.array(z.string()).default([]),
  recommendedDocIds: z.array(z.string()).default([]),
  recommendedExampleIds: z.array(z.string()).default([])
});

export const SeedDatasetSchema = z.object({
  chunks: z.array(DocumentChunkSchema),
  versions: z.array(VersionRecordSchema),
  features: z.array(FeatureRecordSchema),
  migrations: z.array(MigrationNoteRecordSchema),
  packages: z.array(PackageRecordSchema).optional(),
  capabilities: z.array(CapabilityRecordSchema).optional(),
  snapshot: CatalogSnapshotSchema.optional()
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
export type RetrievalFilters = z.infer<typeof RetrievalFiltersSchema>;
export type VersionRecord = z.infer<typeof VersionRecordSchema>;
export type FeatureRecord = z.infer<typeof FeatureRecordSchema>;
export type MigrationNoteRecord = z.infer<typeof MigrationNoteRecordSchema>;
export type SeedDataset = z.infer<typeof SeedDatasetSchema>;
export type PackageRecord = z.infer<typeof PackageRecordSchema>;
export type CapabilityRecord = z.infer<typeof CapabilityRecordSchema>;
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
