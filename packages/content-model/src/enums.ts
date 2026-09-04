import { z } from 'zod';

export const frameworks = ['react', 'vue', 'angular', 'svelte', 'vanilla'] as const;
export const surfaces = [
  'core',
  'pro',
  'pivot',
  'plugin',
  'columntype',
  'migration',
  'changelog',
  'internal'
] as const;
export const docTypes = ['guide', 'api', 'example', 'live-demo', 'migration', 'faq'] as const;
export const stabilities = ['stable', 'experimental', 'deprecated'] as const;
export const products = [
  'core',
  'pro',
  'pivot',
  'gantt',
  'scheduler',
  'kanban',
  'collaboration',
  'enterprise'
] as const;
export const visibilities = ['public', 'internal'] as const;
export const symbolKinds = [
  'class',
  'function',
  'interface',
  'type',
  'enum',
  'variable',
  'event',
  'plugin',
  'component',
  'unknown'
] as const;
export const tiers = ['core', 'pro', 'enterprise'] as const;

export const FrameworkSchema = z.enum(frameworks);
export const SurfaceSchema = z.enum(surfaces);
export const DocTypeSchema = z.enum(docTypes);
export const StabilitySchema = z.enum(stabilities);
export const ProductSchema = z.enum(products);
export const VisibilitySchema = z.enum(visibilities);
export const SymbolKindSchema = z.enum(symbolKinds);
export const TierSchema = z.enum(tiers);

export type Framework = z.infer<typeof FrameworkSchema>;
export type Surface = z.infer<typeof SurfaceSchema>;
export type DocType = z.infer<typeof DocTypeSchema>;
export type Stability = z.infer<typeof StabilitySchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type SymbolKind = z.infer<typeof SymbolKindSchema>;
export type Tier = z.infer<typeof TierSchema>;
