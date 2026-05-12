import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawn: spawnMock
}));

const { updateGithubSources } = await import('../src/services/sourceUpdateService.js');

describe('source update service', () => {
  afterEach(() => {
    spawnMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('updates nested git submodules after moving a source repository forward', async () => {
    vi.stubEnv('REVOGRID_SOURCE_ROOT', '/tmp/revogrid-source');
    spawnMock.mockImplementation((_command: string, args: string[]) => createGitProcess(gitOutput(args)));

    await updateGithubSources({
      repositories: ['revogrid']
    });

    const gitArgs = spawnMock.mock.calls.map(([, args]) => args as string[]);

    expect(gitArgs).toContainEqual([
      '-C',
      '/tmp/revogrid-source',
      'submodule',
      'sync',
      '--recursive'
    ]);
    expect(gitArgs).toContainEqual([
      '-C',
      '/tmp/revogrid-source',
      'submodule',
      'update',
      '--init',
      '--recursive'
    ]);

    const mergeIndex = gitArgs.findIndex((args) => args.includes('merge'));
    const submoduleUpdateIndex = gitArgs.findIndex(
      (args) => args.includes('submodule') && args.includes('update')
    );
    expect(submoduleUpdateIndex).toBeGreaterThan(mergeIndex);
  });
});

function gitOutput(args: string[]): string {
  const gitArgs = args.slice(2);

  if (gitArgs.join(' ') === 'rev-parse --git-dir') {
    return '.git';
  }
  if (gitArgs.join(' ') === 'rev-parse HEAD') {
    return 'before-revision';
  }
  if (gitArgs.join(' ') === 'rev-parse --abbrev-ref HEAD') {
    return 'main';
  }
  if (gitArgs.join(' ') === 'fetch --prune origin') {
    return '';
  }
  if (gitArgs.join(' ') === 'merge --ff-only origin/main') {
    return 'Fast-forward';
  }
  if (gitArgs.join(' ') === 'submodule sync --recursive') {
    return '';
  }
  if (gitArgs.join(' ') === 'submodule update --init --recursive') {
    return '';
  }

  return 'after-revision';
}

function createGitProcess(stdout: string): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  process.nextTick(() => {
    if (stdout) {
      child.stdout.emit('data', Buffer.from(stdout));
    }
    child.emit('exit', 0);
  });

  return child;
}
