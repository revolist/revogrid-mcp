import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildSeedDataset } from '@revogrid-mcp/ingestion';

const outputPath = process.env.REINDEX_OUTPUT ?? 'data/seed-content.json';

async function main(): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  const dataset = buildSeedDataset();
  await writeFile(absolutePath, JSON.stringify(dataset, null, 2));

  console.log(
    JSON.stringify(
      {
        writtenTo: absolutePath,
        chunkCount: dataset.chunks.length,
        featureCount: dataset.features.length,
        migrationCount: dataset.migrations.length
      },
      null,
      2,
    ),
  );
}

void main();
