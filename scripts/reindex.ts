import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { runReindex } from '../src/services/reindexService.js';

async function main(): Promise<void> {
  const { summary } = await runReindex();
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
