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

export const FrameworkSchema = z.enum(frameworks);
export const SurfaceSchema = z.enum(surfaces);
export const DocTypeSchema = z.enum(docTypes);
export const StabilitySchema = z.enum(stabilities);

export type Framework = z.infer<typeof FrameworkSchema>;
export type Surface = z.infer<typeof SurfaceSchema>;
export type DocType = z.infer<typeof DocTypeSchema>;
export type Stability = z.infer<typeof StabilitySchema>;
