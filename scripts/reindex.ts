import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildSeedDataset,
  getApiSources,
  getChangelogSources,
  getDocsSources,
  getExampleSources
} from '@revogrid-mcp/ingestion';

const outputPath = process.env.REINDEX_OUTPUT ?? 'data/seed-content.json';

async function main(): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  const sourceInventory = {
    docs: getDocsSources(),
    examples: getExampleSources(),
    changelog: getChangelogSources(),
    api: getApiSources()
  };
  const dataset = buildSeedDataset();

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(
    absolutePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceInventory,
        dataset
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        writtenTo: absolutePath,
        availableSources: Object.values(sourceInventory).flat().filter((source) => source.exists)
          .length
      },
      null,
      2,
    ),
  );
}

void main();
