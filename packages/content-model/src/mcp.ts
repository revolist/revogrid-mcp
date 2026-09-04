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
import { CapabilityRecordSchema, EvidenceReferenceSchema } from './schema.js';

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
  whyMatched: z.string().optional(),
  product: ProductSchema.optional(),
  packageName: z.string().optional(),
  packageVersion: z.string().optional(),
  visibility: VisibilitySchema.optional(),
  symbolKind: SymbolKindSchema.optional(),
  sourcePath: z.string().optional(),
  sourceRevision: z.string().optional(),
  authority: z.number().optional()
});

export const ExampleResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  framework: FrameworkSchema.optional(),
  version: z.string().optional(),
  surface: SurfaceSchema,
  requiresPro: z.boolean(),
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
  'get_migration_notes',
  'inspect_revogrid_api',
  'plan_revogrid_implementation'
]);

export const SearchRevogridDocsInputSchema = z.object({
  query: z.string().min(1).describe('RevoGrid concept, API symbol, package, or implementation question.'),
  framework: FrameworkSchema.optional().describe('Restrict results to a consumer framework.'),
  version: z.string().optional().describe('Restrict results to an indexed package version.'),
  surface: SurfaceSchema.optional().describe('Legacy catalog surface filter.'),
  requiresPro: z.boolean().optional().describe('Filter by descriptive Pro/license requirement.'),
  docTypes: z.array(DocTypeSchema).optional().describe('Restrict source kinds such as API, guide, or example.'),
  product: ProductSchema.optional().describe('Restrict results to one RevoGrid product.'),
  packageName: z.string().optional().describe('Exact published npm package name.'),
  visibility: VisibilitySchema.optional().describe('Defaults to public; internal requires explicit internal selection.'),
  symbolKind: SymbolKindSchema.optional().describe('Restrict exported declaration kind.'),
  cursor: z.string().optional().describe('Opaque cursor returned by the previous page.'),
  limit: z.number().int().min(1).max(20).default(5).describe('Maximum results per page.')
});

export const SearchRevogridDocsOutputSchema = z.object({
  query: z.string(),
  appliedFilters: z.object({
    framework: FrameworkSchema.optional(),
    version: z.string().optional(),
    surface: SurfaceSchema.optional(),
    requiresPro: z.boolean().optional(),
    docTypes: z.array(DocTypeSchema).optional(),
    product: ProductSchema.optional(),
    packageName: z.string().optional(),
    visibility: VisibilitySchema.optional(),
    symbolKind: SymbolKindSchema.optional(),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(20)
  }),
  results: z.array(SearchResultItemSchema),
  nextCursor: z.string().optional(),
  suggestedNextTool: SuggestedNextToolSchema.optional()
});

export const FindExamplesInputSchema = z.object({
  query: z.string().min(1).describe('Capability or scenario demonstrated by a runnable example.'),
  framework: FrameworkSchema.optional().describe('Preferred example framework.'),
  version: z.string().optional().describe('Indexed package version.'),
  surface: SurfaceSchema.optional().describe('Legacy catalog surface filter.'),
  requiresPro: z.boolean().optional().describe('Filter by descriptive Pro/license requirement.'),
  product: ProductSchema.optional().describe('RevoGrid product demonstrated by the example.'),
  packageName: z.string().optional().describe('Exact published npm package name.'),
  cursor: z.string().optional().describe('Opaque cursor returned by the previous page.'),
  limit: z.number().int().min(1).max(20).default(5).describe('Maximum examples per page.')
});

export const FindExamplesOutputSchema = z.object({
  results: z.array(ExampleResultItemSchema),
  nextCursor: z.string().optional()
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

export const ListRevogridCapabilitiesInputSchema = z.object({
  product: ProductSchema.optional().describe('Restrict capability ownership to one product.'),
  packageName: z.string().optional().describe('Exact published npm package name.'),
  framework: FrameworkSchema.optional().describe('Consumer framework the capability must support.'),
  version: z.string().optional().describe('Exact indexed package version.'),
  stability: StabilitySchema.optional().describe('Stable, experimental, or deprecated capability status.'),
  tier: TierSchema.optional().describe('Core, Pro, or Enterprise package tier.'),
  cursor: z.string().optional().describe('Opaque cursor returned by the previous page.'),
  limit: z.number().int().min(1).max(50).default(20).describe('Maximum compact capability summaries per page.')
});

export const CapabilitySummarySchema = CapabilityRecordSchema.pick({
  id: true,
  name: true,
  aliases: true,
  product: true,
  packageName: true,
  packageVersion: true,
  tier: true,
  requiresPro: true,
  stability: true,
  frameworks: true,
  symbolKind: true
}).extend({
  resourceUri: z.string()
});

export const ListRevogridCapabilitiesOutputSchema = z.object({
  results: z.array(CapabilitySummarySchema),
  nextCursor: z.string().optional()
});

export type CapabilitySummary = z.infer<typeof CapabilitySummarySchema>;

export const InspectRevogridApiInputSchema = z.object({
  query: z.string().min(1).describe('Exact capability, symbol, alias, or package#symbol qualified name.'),
  packageName: z.string().optional().describe('Exact package owner used to disambiguate a symbol.'),
  framework: FrameworkSchema.optional().describe('Required consumer framework compatibility.'),
  version: z.string().optional().describe('Exact indexed package version.'),
  includeInternal: z.boolean().default(false).describe('Opt in to unsupported implementation internals; public exports remain preferred.')
});

export const InspectRevogridApiOutputSchema = z.object({
  status: z.enum(['found', 'ambiguous', 'not-found']),
  match: CapabilityRecordSchema.optional(),
  candidates: z.array(CapabilityRecordSchema).default([]),
  correction: z.string().optional()
});

export const PlanRevogridImplementationInputSchema = z.object({
  objective: z.string().min(1).describe('Concrete data-grid behavior to implement.'),
  requiredCapabilities: z.array(z.string()).default([]).describe('Exact capabilities or aliases required by the objective.'),
  capabilities: z.array(z.string()).optional().describe('Compatibility alias for requiredCapabilities.'),
  framework: FrameworkSchema.default('vanilla').describe('Consumer application framework.'),
  installedVersions: z.record(z.string(), z.string()).optional().describe('Currently installed versions keyed by npm package name.'),
  targetVersions: z.record(z.string(), z.string()).optional().describe('Desired versions keyed by npm package name.'),
  constraints: z.array(z.string()).optional().describe('Architecture, licensing, performance, or compatibility constraints.')
});

export const ImplementationPackageSchema = z.object({
  packageName: z.string(),
  version: z.string().optional(),
  requiresPro: z.boolean()
});

export const ImplementationImportSchema = z.object({
  packageName: z.string(),
  symbol: z.string(),
  importPath: z.string()
});

export const PlanRevogridImplementationOutputSchema = z.object({
  objective: z.string(),
  framework: FrameworkSchema,
  packages: z.array(ImplementationPackageSchema),
  imports: z.array(ImplementationImportSchema),
  pluginOrder: z.array(z.string()),
  configuration: z.array(z.string()),
  lifecycle: z.array(z.string()),
  dataFlow: z.array(z.string()),
  events: z.array(z.string()),
  methods: z.array(z.string()),
  evidence: z.array(EvidenceReferenceSchema),
  constraints: z.array(z.string()),
  warnings: z.array(z.string()),
  unresolved: z.array(z.string())
});

export const ValidateRevogridUsageInputSchema = z.object({
  framework: FrameworkSchema.optional().describe('Consumer application framework.'),
  imports: z.array(z.object({
    packageName: z.string().describe('Exact npm import package.'),
    symbols: z.array(z.string()).describe('Named symbols imported from the package.')
  })).default([]).describe('Structured imports to validate without execution.'),
  features: z.array(z.string()).optional().describe('Capabilities the application intends to use.'),
  configuration: z.array(z.object({
    capability: z.string(),
    packageName: z.string().optional(),
    keys: z.array(z.string())
  })).optional().describe('Configuration keys grouped by their owning capability.'),
  installedVersions: z.record(z.string(), z.string()).optional().describe('Installed versions keyed by npm package name.'),
  sourceSnippet: z.string().max(50_000).optional().describe('Optional bounded source used only for static import inspection; never executed.')
});

export const UsageDiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string()
});

export const ValidateRevogridUsageOutputSchema = z.object({
  valid: z.boolean(),
  diagnostics: z.array(UsageDiagnosticSchema)
});
