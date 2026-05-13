import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageJson = {
  name: string;
  displayName: string;
  description: string;
  version: string;
  contributes?: {
    mcpServerDefinitionProviders?: Array<{
      id: string;
      label: string;
    }>;
  };
  [key: string]: unknown;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceTmp = path.join(root, '.tmp');
const packageDir = path.join(workspaceTmp, 'vscode-pro-package');

const [, , command = 'package', ...passThroughArgs] = process.argv;

if (command !== 'package' && command !== 'publish') {
  throw new Error('Usage: tsx scripts/packageVscodeVariant.ts <package|publish> [vsce args...]');
}

await rm(packageDir, { recursive: true, force: true });
await mkdir(path.join(packageDir, 'dist', 'vscode'), { recursive: true });
await mkdir(path.join(packageDir, 'assets'), { recursive: true });

await Promise.all([
  cp(path.join(root, 'dist', 'vscode', 'extension.cjs'), path.join(packageDir, 'dist', 'vscode', 'extension.cjs')),
  cp(path.join(root, 'assets', 'logo.png'), path.join(packageDir, 'assets', 'logo.png')),
  cp(path.join(root, '.vscodeignore'), path.join(packageDir, '.vscodeignore')),
  cp(path.join(root, 'README.md'), path.join(packageDir, 'README.md'))
]);

const packageJson = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
) as PackageJson;

packageJson.name = 'revogrid-datagrid-mcp-pro';
packageJson.displayName = 'RevoGrid DataGrid MCP Pro';
packageJson.description = 'MCP server package for Pro-gated RevoGrid DataGrid knowledge retrieval.';
packageJson.revogridMcpVariant = 'pro';
packageJson.contributes = {
  ...packageJson.contributes,
  mcpServerDefinitionProviders: [
    {
      id: 'revogrid.proMcpServers',
      label: 'RevoGrid DataGrid MCP Pro'
    }
  ]
};

await writeFile(
  path.join(packageDir, 'package.json'),
  `${JSON.stringify(packageJson, null, 2)}\n`,
);

const vsceArgs = [command, '--no-dependencies', ...passThroughArgs];
if (command === 'package' && !hasOutputArg(passThroughArgs)) {
  vsceArgs.push('--out', path.join(root, `${packageJson.name}-${packageJson.version}.vsix`));
}

const vsceBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vsce.cmd' : 'vsce');
const result = spawnSync(vsceBin, vsceArgs, {
  cwd: packageDir,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

function hasOutputArg(args: string[]) {
  return args.includes('-o') || args.includes('--out');
}
