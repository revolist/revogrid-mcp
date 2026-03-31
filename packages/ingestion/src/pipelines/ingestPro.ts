import type { SeedDataset } from '@revogrid-mcp/content-model';

import { buildCatalogDataset } from './buildCatalog.js';

export async function ingestFullContent(): Promise<SeedDataset> {
  return buildCatalogDataset();
}
