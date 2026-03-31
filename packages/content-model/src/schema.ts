import { z } from 'zod';

import {
  DocTypeSchema,
  EntitlementSchema,
  FrameworkSchema,
  StabilitySchema,
  SurfaceSchema
} from './enums.js';

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
  releaseDate: z.string().optional()
});

export const RetrievalFiltersSchema = z.object({
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema.optional(),
  requiresPro: z.boolean().optional(),
  docTypes: z.array(DocTypeSchema).optional(),
  entitlement: EntitlementSchema.default('anonymous'),
  limit: z.number().int().min(1).max(20).default(5)
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
  migrations: z.array(MigrationNoteRecordSchema)
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
export type RetrievalFilters = z.infer<typeof RetrievalFiltersSchema>;
export type VersionRecord = z.infer<typeof VersionRecordSchema>;
export type FeatureRecord = z.infer<typeof FeatureRecordSchema>;
export type MigrationNoteRecord = z.infer<typeof MigrationNoteRecordSchema>;
export type SeedDataset = z.infer<typeof SeedDatasetSchema>;
