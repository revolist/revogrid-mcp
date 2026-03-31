import type { SeedDataset } from '@revogrid-mcp/content-model';

import { buildSeedDataset } from '../fixtures/seedData.js';

export function ingestPublicSeedContent(): SeedDataset {
  // TODO(revogrid-real-ingestion): replace seeded chunks with parsed public docs from ../revogrid/docs and public examples from ../revogrid/packages/*/demo.
  const dataset = buildSeedDataset();

  return {
    ...dataset,
    chunks: dataset.chunks.filter((chunk) => !chunk.requiresPro),
    features: dataset.features.filter((feature) => !feature.requiresPro)
  };
}
