import { describe, expect, it } from 'vitest';

import { DocumentChunkSchema, SeedDatasetSchema } from './schema.js';

describe('content model schemas', () => {
  it('accepts a valid chunk', () => {
    const result = DocumentChunkSchema.parse({
      id: 'chunk-1',
      title: 'Editable React Grid',
      body: 'Demo content',
      framework: 'react',
      surface: 'core',
      docType: 'guide',
      requiresPro: false,
      symbols: ['beforeedit'],
      url: 'https://rv-grid.com/guide/react/editing'
    });

    expect(result.title).toBe('Editable React Grid');
  });

  it('accepts a seed dataset', () => {
    const result = SeedDatasetSchema.parse({
      chunks: [],
      versions: [],
      features: [],
      migrations: []
    });

    expect(result).toEqual({
      chunks: [],
      versions: [],
      features: [],
      migrations: []
    });
  });
});
