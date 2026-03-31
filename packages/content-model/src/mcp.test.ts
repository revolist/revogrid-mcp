import { describe, expect, it } from 'vitest';

import {
  FindExamplesInputSchema,
  ResolveFeatureMatrixOutputSchema,
  SearchRevogridDocsInputSchema
} from './mcp.js';

describe('mcp schemas', () => {
  it('applies default limits for doc search input', () => {
    const parsed = SearchRevogridDocsInputSchema.parse({
      query: 'editable React grid'
    });

    expect(parsed.limit).toBe(5);
  });

  it('applies default limits for examples input', () => {
    const parsed = FindExamplesInputSchema.parse({
      query: 'custom column type'
    });

    expect(parsed.limit).toBe(5);
  });

  it('keeps feature matrix outputs compact and array-based', () => {
    const parsed = ResolveFeatureMatrixOutputSchema.parse({
      featureName: 'beforeedit',
      supported: true,
      requiresPro: false,
      supportedFrameworks: ['react'],
      notes: [],
      bestDocs: [],
      bestExamples: []
    });

    expect(parsed.bestDocs).toEqual([]);
    expect(parsed.bestExamples).toEqual([]);
  });
});
