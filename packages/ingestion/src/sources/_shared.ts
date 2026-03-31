import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  resolveFromParentRepo,
  resolveFromWorkspace
} from '@revogrid-mcp/shared';

import type {
  SourceCategory,
  SourceFile,
  SourceRepository,
  SourceRoot
} from './types.js';

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.svelte',
  '.astro'
]);

type RootConfig = {
  repository: SourceRepository;
  envVar: 'REVOGRID_SOURCE_ROOT' | 'REVOGRID_PRO_SOURCE_ROOT';
  nestedSubmodulePath: string;
  parentRepoPath: string;
};

const ROOT_CONFIGS: Record<SourceRepository, RootConfig> = {
  revogrid: {
    repository: 'revogrid',
    envVar: 'REVOGRID_SOURCE_ROOT',
    nestedSubmodulePath: 'external/revogrid',
    parentRepoPath: 'revogrid'
  },
  'revogrid-pro': {
    repository: 'revogrid-pro',
    envVar: 'REVOGRID_PRO_SOURCE_ROOT',
    nestedSubmodulePath: 'external/revogrid-pro',
    parentRepoPath: 'revogrid-pro'
  }
};

export async function resolveSourceRoot(
  fromFileUrl: string,
  repository: SourceRepository,
): Promise<SourceRoot> {
  const config = ROOT_CONFIGS[repository];
  const envValue = process.env[config.envVar];

  const candidates = [
    envValue
      ? {
          path: path.resolve(envValue),
          source: 'env' as const
        }
      : null,
    {
      path: resolveFromWorkspace(fromFileUrl, config.nestedSubmodulePath),
      source: 'nested-submodule' as const
    },
    {
      path: resolveFromParentRepo(fromFileUrl, config.parentRepoPath),
      source: 'parent-repo' as const
    }
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const exists = await pathExists(candidate.path);
    if (exists) {
      return {
        repository,
        rootPath: candidate.path,
        exists: true,
        source: candidate.source
      };
    }
  }

  return {
    repository,
    rootPath: candidates[0]?.path ?? resolveFromWorkspace(fromFileUrl, config.nestedSubmodulePath),
    exists: false,
    source: candidates[0]?.source ?? 'nested-submodule'
  };
}

export async function collectSourceFiles(
  root: SourceRoot,
  category: SourceCategory,
  relativeDirectories: string[],
): Promise<SourceFile[]> {
  if (!root.exists) {
    return [];
  }

  const files: SourceFile[] = [];

  for (const relativeDirectory of relativeDirectories) {
    const absoluteDirectory = path.join(root.rootPath, relativeDirectory);
    if (!(await pathExists(absoluteDirectory))) {
      continue;
    }

    const sourcePaths = (await isDirectory(absoluteDirectory))
      ? await walkDirectory(absoluteDirectory)
      : [absoluteDirectory];

    for (const absolutePath of sourcePaths) {
      const extension = path.extname(absolutePath).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      const relativePath = path.relative(root.rootPath, absolutePath);
      files.push({
        category,
        repository: root.repository,
        absolutePath,
        relativePath,
        rootPath: root.rootPath,
        source: root.source,
        requiresPro: inferRequiresPro(root.repository, relativePath)
      });
    }
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function walkDirectory(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map(async (entry) => {
        const absolutePath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          return walkDirectory(absolutePath);
        }

        return [absolutePath];
      }),
  );

  return files.flat();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

function inferRequiresPro(repository: SourceRepository, relativePath: string): boolean {
  return (
    repository === 'revogrid-pro' ||
    relativePath.includes('.pro.') ||
    relativePath.includes('/pro/') ||
    relativePath.toLowerCase().includes('pivot')
  );
}
