import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { lstat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { resolveFromWorkspace } from '@revogrid-mcp/shared';

type GitRepository = 'revogrid' | 'revogrid-pro';

export type SourceUpdateOptions = {
  githubToken?: string;
  repositories?: GitRepository[];
};

export type SourceUpdateRepositorySummary = {
  repository: GitRepository;
  rootPath: string;
  beforeRevision: string;
  afterRevision: string;
  branch: string;
  rehydrated: boolean;
  updated: boolean;
};

export type SourceUpdateSummary = {
  repositories: SourceUpdateRepositorySummary[];
};

type RepositoryConfig = {
  repository: GitRepository;
  envVar: 'REVOGRID_SOURCE_ROOT' | 'REVOGRID_PRO_SOURCE_ROOT';
  defaultPath: string;
  remoteUrl: string;
};

const REPOSITORIES: RepositoryConfig[] = [
  {
    repository: 'revogrid',
    envVar: 'REVOGRID_SOURCE_ROOT',
    defaultPath: 'external/revogrid',
    remoteUrl: 'https://github.com/revolist/revogrid.git'
  },
  {
    repository: 'revogrid-pro',
    envVar: 'REVOGRID_PRO_SOURCE_ROOT',
    defaultPath: 'external/revogrid-pro',
    remoteUrl: 'https://github.com/revolist/revogrid-pro.git'
  }
];

export async function updateGithubSources(options: SourceUpdateOptions = {}): Promise<SourceUpdateSummary> {
  const requestedRepositories = new Set(options.repositories ?? REPOSITORIES.map((config) => config.repository));
  const repositories = REPOSITORIES.filter((config) => requestedRepositories.has(config.repository));

  const summaries = [];
  for (const repository of repositories) {
    summaries.push(await updateRepository(repository, options.githubToken));
  }

  return {
    repositories: summaries
  };
}

async function updateRepository(
  config: RepositoryConfig,
  githubToken: string | undefined,
): Promise<SourceUpdateRepositorySummary> {
  const rootPath = resolveRepositoryRoot(config);
  const hasUsableGitMetadata = await isUsableGitRepository(rootPath, githubToken);
  const beforeRevision = hasUsableGitMetadata
    ? await resolveCurrentRevision(rootPath, githubToken)
    : 'unavailable';

  if (!hasUsableGitMetadata) {
    await rehydrateRepository(rootPath, config.remoteUrl, githubToken);
  }

  await runGit(rootPath, ['fetch', '--prune', 'origin'], githubToken);

  const branch = await resolveUpdateBranch(rootPath, githubToken);
  if (hasUsableGitMetadata) {
    await runGit(rootPath, ['merge', '--ff-only', `origin/${branch}`], githubToken);
  } else {
    await runGit(rootPath, ['reset', '--hard', `origin/${branch}`], githubToken);
    await runGit(rootPath, ['clean', '-fd'], githubToken);
  }

  const afterRevision = await runGit(rootPath, ['rev-parse', 'HEAD'], githubToken);

  return {
    repository: config.repository,
    rootPath,
    beforeRevision,
    afterRevision,
    branch,
    rehydrated: !hasUsableGitMetadata,
    updated: beforeRevision !== afterRevision
  };
}

async function resolveCurrentRevision(rootPath: string, githubToken: string | undefined): Promise<string> {
  const revision = await runGit(rootPath, ['rev-parse', 'HEAD'], githubToken, {
    allowFailure: true
  });

  return revision || 'unavailable';
}

async function isUsableGitRepository(rootPath: string, githubToken: string | undefined): Promise<boolean> {
  const gitDir = await runGit(rootPath, ['rev-parse', '--git-dir'], githubToken, {
    allowFailure: true
  });

  return gitDir.length > 0;
}

async function rehydrateRepository(
  rootPath: string,
  remoteUrl: string,
  githubToken: string | undefined,
): Promise<void> {
  await removeBrokenGitFile(rootPath);
  await runGit(rootPath, ['init'], githubToken);
  await runGit(rootPath, ['remote', 'remove', 'origin'], githubToken, {
    allowFailure: true
  });
  await runGit(rootPath, ['remote', 'add', 'origin', remoteUrl], githubToken);
}

async function removeBrokenGitFile(rootPath: string): Promise<void> {
  const gitPath = path.join(rootPath, '.git');

  try {
    const stats = await lstat(gitPath);
    if (stats.isFile()) {
      await unlink(gitPath);
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

function resolveRepositoryRoot(config: RepositoryConfig): string {
  const envValue = process.env[config.envVar];
  if (envValue) {
    return path.resolve(envValue);
  }

  return resolveFromWorkspace(import.meta.url, config.defaultPath);
}

async function resolveUpdateBranch(rootPath: string, githubToken: string | undefined): Promise<string> {
  const currentBranch = await runGit(rootPath, ['rev-parse', '--abbrev-ref', 'HEAD'], githubToken, {
    allowFailure: true
  });
  if (currentBranch && currentBranch !== 'HEAD') {
    return currentBranch;
  }

  const remoteHead = await runGit(rootPath, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], githubToken, {
    allowFailure: true
  });
  const branch = remoteHead?.replace(/^origin\//, '');
  if (branch) {
    return branch;
  }

  const remoteDefaultBranch = await resolveRemoteDefaultBranch(rootPath, githubToken);
  if (remoteDefaultBranch) {
    return remoteDefaultBranch;
  }

  return 'main';
}

async function resolveRemoteDefaultBranch(
  rootPath: string,
  githubToken: string | undefined,
): Promise<string | undefined> {
  const remoteHead = await runGit(rootPath, ['ls-remote', '--symref', 'origin', 'HEAD'], githubToken, {
    allowFailure: true
  });
  const match = remoteHead.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD/m);

  return match?.[1];
}

async function runGit(
  rootPath: string,
  args: string[],
  githubToken: string | undefined,
  options: { allowFailure?: boolean } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', rootPath, ...args], {
      env: buildGitEnv(githubToken),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      const output = Buffer.concat(stdout).toString('utf8').trim();
      if (code === 0) {
        resolve(output);
        return;
      }

      if (options.allowFailure) {
        resolve('');
        return;
      }

      const message = Buffer.concat(stderr).toString('utf8').trim() || output;
      reject(new Error(`git -C ${rootPath} ${args.join(' ')} failed: ${message}`));
    });
  });
}

function buildGitEnv(githubToken: string | undefined): NodeJS.ProcessEnv {
  if (!githubToken) {
    return process.env;
  }

  return {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${githubToken}`).toString('base64')}`
  };
}
