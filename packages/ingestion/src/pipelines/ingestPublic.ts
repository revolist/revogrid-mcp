import type { SeedDataset } from '@revogrid-mcp/content-model';

import { buildCatalogDataset } from './buildCatalog.js';

export async function ingestPublicContent(): Promise<SeedDataset> {
  const dataset = await buildCatalogDataset();

  return {
    ...dataset,
    chunks: dataset.chunks.filter((chunk) => !chunk.requiresPro),
    features: dataset.features.filter((feature) => !feature.requiresPro)
  };
}
