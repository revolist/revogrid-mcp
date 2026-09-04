import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import ts from 'typescript';

import type {
  Framework,
  PackageRecord,
  Product,
  SymbolKind,
  Tier
} from '@revogrid-mcp/content-model';

import type { SourceRepository, SourceRoot } from './types.js';

type PackageDefinition = {
  repository: SourceRepository;
  packageDirectory: string;
  entrypoint: string;
  product: Product;
  tier: Tier;
  framework?: Framework;
};

export type PublicExport = {
  name: string;
  packageName: string;
  exportPath: string;
  sourcePath: string;
  symbolKind: SymbolKind;
  signature?: string;
  configurationKeys?: string[];
  methods?: string[];
  events?: string[];
  deprecated?: boolean;
};

export type PublishedPackageCatalog = {
  packages: PackageRecord[];
  exports: PublicExport[];
  publicSourcePaths: Set<string>;
  sourceRevisions: Record<string, string>;
};

const execFileAsync = promisify(execFile);

const DEFINITIONS: PackageDefinition[] = [
  { repository: 'revogrid', packageDirectory: '.', entrypoint: 'src/index.ts', product: 'core', tier: 'core' },
  { repository: 'revogrid', packageDirectory: 'packages/react', entrypoint: 'lib/index.ts', product: 'core', tier: 'core', framework: 'react' },
  { repository: 'revogrid', packageDirectory: 'packages/vue3', entrypoint: 'lib/index.ts', product: 'core', tier: 'core', framework: 'vue' },
  { repository: 'revogrid', packageDirectory: 'packages/angular/projects/angular-datagrid', entrypoint: 'src/public-api.ts', product: 'core', tier: 'core', framework: 'angular' },
  { repository: 'revogrid', packageDirectory: 'packages/svelte', entrypoint: 'lib/index.ts', product: 'core', tier: 'core', framework: 'svelte' },
  { repository: 'revogrid-pro', packageDirectory: 'packages/pro', entrypoint: 'index.ts', product: 'pro', tier: 'pro' },
  { repository: 'revogrid-pro', packageDirectory: 'packages/pivot', entrypoint: 'src/index.ts', product: 'pivot', tier: 'enterprise' },
  { repository: 'revogrid-pro', packageDirectory: 'packages/gantt', entrypoint: 'src/index.ts', product: 'gantt', tier: 'enterprise' },
  { repository: 'revogrid-pro', packageDirectory: 'packages/scheduler', entrypoint: 'src/index.ts', product: 'scheduler', tier: 'enterprise' },
  { repository: 'revogrid-pro', packageDirectory: 'packages/kanban', entrypoint: 'src/index.ts', product: 'kanban', tier: 'enterprise' },
  {
    repository: 'revogrid-pro',
    packageDirectory: 'packages/collaborative-editing',
    entrypoint: 'plugins/collaborative-editing/index.ts',
    product: 'collaboration',
    tier: 'pro'
  },
  { repository: 'revogrid-pro', packageDirectory: 'packages/enterprise', entrypoint: 'plugins/index.ts', product: 'enterprise', tier: 'enterprise' }
];

export async function buildPublishedPackageCatalog(
  roots: Record<SourceRepository, SourceRoot>,
): Promise<PublishedPackageCatalog> {
  const packages: PackageRecord[] = [];
  const exports: PublicExport[] = [];
  const publicSourcePaths = new Set<string>();
  const sourceRevisions: Record<string, string> = {};
  for (const [repository, root] of Object.entries(roots)) {
    const revision = await resolveRevision(root.rootPath);
    if (revision) sourceRevisions[repository] = revision;
  }

  for (const definition of DEFINITIONS) {
    const root = roots[definition.repository];
    if (!root.exists) {
      continue;
    }
    const packageRoot = path.join(root.rootPath, definition.packageDirectory);
    const manifest = await readManifest(path.join(packageRoot, 'package.json'));
    if (!manifest?.name || !manifest.version) {
      continue;
    }

    const entrypointPath = path.join(packageRoot, definition.entrypoint);
    if (!(await exists(entrypointPath))) {
      continue;
    }
    const relativeEntrypoint = path.relative(root.rootPath, entrypointPath).replace(/\\/g, '/');
    const discovered = await collectExports(entrypointPath, root.rootPath, manifest.name);
    discovered.sourcePaths.forEach((sourcePath) => publicSourcePaths.add(`${definition.repository}:${sourcePath}`));
    exports.push(...discovered.exports);
    packages.push({
      name: manifest.name,
      version: manifest.version,
      product: definition.product,
      ...(definition.framework ? { framework: definition.framework } : {}),
      tier: definition.tier,
      requiresPro: definition.tier !== 'core',
      entrypoint: `${definition.repository}/${relativeEntrypoint}`,
      exportEntrypoints: Object.keys(manifest.exports ?? { '.': {} }).sort(),
      dependencies: Object.keys(manifest.dependencies ?? {}).sort(),
      peerDependencies: Object.keys(manifest.peerDependencies ?? {}).sort(),
      sourceRevision: sourceRevisions[definition.repository]
    });
  }

  const enterprise = packages.find((item) => item.name === '@revolist/revogrid-enterprise');
  if (enterprise) {
    const reexportedPackages = new Set(enterprise.dependencies);
    exports.push(
      ...exports
        .filter((item) => reexportedPackages.has(item.packageName))
        .map((item) => ({ ...item, packageName: enterprise.name, exportPath: enterprise.name })),
    );
  }

  return {
    packages: packages.sort((left, right) => left.name.localeCompare(right.name)),
    exports: deduplicateExports(exports),
    publicSourcePaths,
    sourceRevisions
  };
}

async function resolveRevision(rootPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', rootPath, 'rev-parse', 'HEAD']);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function collectExports(
  entrypointPath: string,
  repositoryRoot: string,
  packageName: string,
): Promise<{ exports: PublicExport[]; sourcePaths: Set<string> }> {
  const found: PublicExport[] = [];
  const sourcePaths = new Set<string>();
  const visited = new Set<string>();

  async function visit(filePath: string): Promise<void> {
    const resolvedFile = await resolveTypeScriptFile(filePath);
    if (!resolvedFile || visited.has(resolvedFile)) {
      return;
    }
    visited.add(resolvedFile);
    const sourcePath = path.relative(repositoryRoot, resolvedFile).replace(/\\/g, '/');
    sourcePaths.add(sourcePath);
    const content = await readFile(resolvedFile, 'utf8');
    const sourceFile = ts.createSourceFile(resolvedFile, content, ts.ScriptTarget.Latest, true);

    for (const statement of sourceFile.statements) {
      if (ts.isExportDeclaration(statement)) {
        const moduleName = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
        if (moduleName?.startsWith('.')) {
          await visit(path.resolve(path.dirname(resolvedFile), moduleName));
        }
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            found.push(exportRecord(element.name.text, packageName, sourcePath, 'unknown'));
          }
        }
        continue;
      }
      if (!hasExportModifier(statement)) {
        continue;
      }
      const named = declarationName(statement);
      if (named) {
        found.push(exportRecord(
          named.name,
          packageName,
          sourcePath,
          named.kind,
          named.signature,
          named.configurationKeys,
          named.methods,
          named.events,
          named.deprecated,
        ));
      }
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            found.push(exportRecord(
              declaration.name.text,
              packageName,
              sourcePath,
              'variable',
              compactSignature(declaration.getText(sourceFile)),
              undefined,
              undefined,
              undefined,
              isDeprecated(declaration),
            ));
          }
        }
      }
    }
  }

  await visit(entrypointPath);
  return { exports: found, sourcePaths };
}

function declarationName(node: ts.Statement): {
  name: string;
  kind: SymbolKind;
  signature?: string;
  configurationKeys?: string[];
  methods?: string[];
  events?: string[];
  deprecated?: boolean;
} | null {
  if (ts.isClassDeclaration(node) && node.name) return named(node, node.name.text, 'class');
  if (ts.isFunctionDeclaration(node) && node.name) return named(node, node.name.text, 'function');
  if (ts.isInterfaceDeclaration(node)) return named(node, node.name.text, 'interface');
  if (ts.isTypeAliasDeclaration(node)) return named(node, node.name.text, 'type');
  if (ts.isEnumDeclaration(node)) return named(node, node.name.text, 'enum');
  return null;
}

function named(node: ts.Node, name: string, kind: SymbolKind) {
  const members: readonly (ts.TypeElement | ts.ClassElement)[] =
    ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      ? node.members
      : [];
  const propertyNames = members
    .filter((member) => ts.isPropertySignature(member) || ts.isPropertyDeclaration(member))
    .map((member) => member.name?.getText())
    .filter((value): value is string => Boolean(value));
  const methods = members
    .filter((member) => ts.isMethodSignature(member) || ts.isMethodDeclaration(member))
    .map((member) => member.name?.getText())
    .filter((value): value is string => Boolean(value));
  const configurationKeys = /(?:config|options|props)$/i.test(name) ? propertyNames : [];
  return {
    name,
    kind,
    signature: compactSignature(node.getText().split('{')[0] ?? node.getText()),
    ...(configurationKeys.length > 0 ? { configurationKeys } : {}),
    ...(methods.length > 0 ? { methods } : {}),
    ...(propertyNames.some((value) => /(?:event|before|after|change)/i.test(value))
      ? { events: propertyNames.filter((value) => /(?:event|before|after|change)/i.test(value)) }
      : {}),
    ...(isDeprecated(node) ? { deprecated: true } : {})
  };
}

function isDeprecated(node: ts.Node): boolean {
  return ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'deprecated');
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.getModifiers(node as ts.HasModifiers)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function exportRecord(
  name: string,
  packageName: string,
  sourcePath: string,
  symbolKind: SymbolKind,
  signature?: string,
  configurationKeys?: string[],
  methods?: string[],
  events?: string[],
  deprecated?: boolean,
): PublicExport {
  return {
    name,
    packageName,
    sourcePath,
    exportPath: packageName,
    symbolKind,
    ...(signature ? { signature } : {}),
    ...(configurationKeys?.length ? { configurationKeys } : {}),
    ...(methods?.length ? { methods } : {}),
    ...(events?.length ? { events } : {}),
    ...(deprecated ? { deprecated: true } : {})
  };
}

async function resolveTypeScriptFile(candidate: string): Promise<string | null> {
  const candidates = [candidate, `${candidate}.ts`, `${candidate}.tsx`, path.join(candidate, 'index.ts'), path.join(candidate, 'index.tsx')];
  for (const filePath of candidates) {
    if (await exists(filePath)) return filePath;
  }
  return null;
}

async function readManifest(filePath: string): Promise<{
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
} | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const manifest = parsed as Record<string, unknown>;
    return {
      ...(typeof manifest.name === 'string' ? { name: manifest.name } : {}),
      ...(typeof manifest.version === 'string' ? { version: manifest.version } : {}),
      ...(isStringRecord(manifest.dependencies) ? { dependencies: manifest.dependencies } : {}),
      ...(isStringRecord(manifest.peerDependencies) ? { peerDependencies: manifest.peerDependencies } : {}),
      ...(isRecord(manifest.exports) ? { exports: manifest.exports } : {})
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function compactSignature(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function deduplicateExports(exports: PublicExport[]): PublicExport[] {
  const found = new Map<string, PublicExport>();
  for (const item of exports) {
    const key = `${item.packageName}:${item.name}`;
    const current = found.get(key);
    if (!current || (current.symbolKind === 'unknown' && item.symbolKind !== 'unknown')) {
      found.set(key, item);
    }
  }
  return [...found.values()].sort((left, right) =>
    left.packageName.localeCompare(right.packageName) || left.name.localeCompare(right.name),
  );
}
