import { updateGithubSources } from '../src/services/sourceUpdateService.js';

async function main(): Promise<void> {
  parseOptions(process.argv.slice(2));

  const summary = await updateGithubSources({
    githubToken: process.env.SOURCE_UPDATE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN
  });
  console.log(JSON.stringify(summary, null, 2));
}

function parseOptions(args: string[]): void {
  const unknown = args.filter((arg) => arg !== '--remote');
  if (unknown.length > 0) {
    throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
