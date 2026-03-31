import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SeedDataset } from '@revogrid-mcp/content-model';
import { SeedDatasetSchema } from '@revogrid-mcp/content-model';
import { tokenize, unique } from '@revogrid-mcp/shared';

const outputPath = process.env.REINDEX_OUTPUT ?? 'data/catalog.json';

async function main(): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  const fileContents = await readFile(absolutePath, 'utf8');
  const raw = JSON.parse(fileContents) as SeedDataset | { dataset: SeedDataset; [key: string]: unknown };
  const dataset = SeedDatasetSchema.parse('dataset' in raw ? raw.dataset : raw);

  const enriched: SeedDataset = {
    ...dataset,
    chunks: dataset.chunks.map((chunk) => ({
      ...chunk,
      symbols: unique([
        ...chunk.symbols,
        ...tokenize(chunk.title),
        ...(chunk.packageNames ?? []).flatMap((packageName) => tokenize(packageName))
      ])
    }))
  };

  const nextPayload = 'dataset' in raw ? { ...raw, dataset: enriched } : enriched;

  await writeFile(absolutePath, JSON.stringify(nextPayload, null, 2));
  console.log(JSON.stringify({ writtenTo: absolutePath, chunkCount: enriched.chunks.length }, null, 2));
}

void main();
