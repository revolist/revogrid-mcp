import { z } from 'zod';

import {
  DocTypeSchema,
  FrameworkSchema,
  StabilitySchema,
  SurfaceSchema
} from './enums.js';

export const SearchResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema,
  docType: DocTypeSchema,
  requiresPro: z.boolean(),
  symbols: z.array(z.string()),
  score: z.number(),
  snippet: z.string(),
  url: z.string().url(),
  exampleUrl: z.string().url().optional(),
  whyMatched: z.string().optional()
});

export const ExampleResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema,
  summary: z.string(),
  packages: z.array(z.string()),
  sourceUrl: z.string().optional(),
  exampleUrl: z.string().url().optional(),
  score: z.number()
});

export const SuggestedNextToolSchema = z.enum([
  'search_revogrid_docs',
  'find_examples',
  'resolve_feature_matrix',
  'get_migration_notes'
]);

export const SearchRevogridDocsInputSchema = z.object({
  query: z.string().min(1),
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema.optional(),
  requiresPro: z.boolean().optional(),
  docTypes: z.array(DocTypeSchema).optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export const SearchRevogridDocsOutputSchema = z.object({
  query: z.string(),
  appliedFilters: z.object({
    framework: FrameworkSchema.optional(),
    version: z.string().optional(),
    surface: SurfaceSchema.optional(),
    requiresPro: z.boolean().optional(),
    docTypes: z.array(DocTypeSchema).optional(),
    limit: z.number().int().min(1).max(20)
  }),
  results: z.array(SearchResultItemSchema),
  suggestedNextTool: SuggestedNextToolSchema.optional()
});

export const FindExamplesInputSchema = z.object({
  query: z.string().min(1),
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema.optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export const FindExamplesOutputSchema = z.object({
  results: z.array(ExampleResultItemSchema)
});

export const ResolveFeatureMatrixInputSchema = z.object({
  featureName: z.string().min(1),
  framework: FrameworkSchema.optional(),
  version: z.string().optional()
});

export const ResolveFeatureMatrixOutputSchema = z.object({
  featureName: z.string(),
  supported: z.boolean(),
  requiresPro: z.boolean(),
  stability: StabilitySchema.optional(),
  supportedFrameworks: z.array(FrameworkSchema),
  notes: z.array(z.string()).default([]),
  bestDocs: z.array(SearchResultItemSchema).default([]),
  bestExamples: z.array(ExampleResultItemSchema).default([]),
  fallbackApproach: z.string().optional()
});

export const RenamedSymbolSchema = z.object({
  from: z.string(),
  to: z.string()
});

export const GetMigrationNotesInputSchema = z.object({
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  framework: FrameworkSchema.optional()
});

export const GetMigrationNotesOutputSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  framework: FrameworkSchema.optional(),
  breakingChanges: z.array(z.string()),
  renamedSymbols: z.array(RenamedSymbolSchema),
  changedDefaults: z.array(z.string()),
  packageChanges: z.array(z.string()),
  recommendedDocs: z.array(SearchResultItemSchema),
  recommendedExamples: z.array(ExampleResultItemSchema)
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type ExampleResultItem = z.infer<typeof ExampleResultItemSchema>;
export type SearchRevogridDocsInput = z.infer<typeof SearchRevogridDocsInputSchema>;
export type SearchRevogridDocsOutput = z.infer<typeof SearchRevogridDocsOutputSchema>;
export type FindExamplesInput = z.infer<typeof FindExamplesInputSchema>;
export type FindExamplesOutput = z.infer<typeof FindExamplesOutputSchema>;
export type ResolveFeatureMatrixInput = z.infer<typeof ResolveFeatureMatrixInputSchema>;
export type ResolveFeatureMatrixOutput = z.infer<typeof ResolveFeatureMatrixOutputSchema>;
export type GetMigrationNotesInput = z.infer<typeof GetMigrationNotesInputSchema>;
export type GetMigrationNotesOutput = z.infer<typeof GetMigrationNotesOutputSchema>;
