import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());
const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn()
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock
}));

vi.mock('node:fs/promises', () => fsMock);

const { updateGithubSources } = await import('../src/services/sourceUpdateService.js');

describe('source update service', () => {
  afterEach(() => {
    spawnMock.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.readdir.mockReset();
    fsMock.rm.mockReset();
    vi.unstubAllEnvs();
  });

  it('replaces a source repository and updates nested git submodules', async () => {
    vi.stubEnv('REVOGRID_SOURCE_ROOT', '/tmp/revogrid-source');
    fsMock.readdir.mockResolvedValue([]);
    spawnMock.mockImplementation((_command: string, args: string[]) => createGitProcess(gitOutput(args)));

    await updateGithubSources({
      repositories: ['revogrid']
    });

    const gitArgs = spawnMock.mock.calls.map(([, args]) => args as string[]);

    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/revogrid-source', {
      recursive: true,
      force: true
    });
    expect(fsMock.mkdir).toHaveBeenCalledWith('/tmp/revogrid-source', {
      recursive: true
    });
    expect(gitArgs).toContainEqual([
      'clone',
      'https://github.com/revolist/revogrid.git',
      '/tmp/revogrid-source'
    ]);
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

    expect(gitArgs.some((args) => args.includes('fetch'))).toBe(false);
    expect(gitArgs.some((args) => args.includes('merge'))).toBe(false);
    expect(gitArgs.some((args) => args.includes('reset'))).toBe(false);

    const cloneIndex = gitArgs.findIndex((args) => args.includes('clone'));
    const submoduleUpdateIndex = gitArgs.findIndex(
      (args) => args.includes('submodule') && args.includes('update')
    );
    expect(submoduleUpdateIndex).toBeGreaterThan(cloneIndex);
  });
});

function gitOutput(args: string[]): string {
  if (args.join(' ') === 'clone https://github.com/revolist/revogrid.git /tmp/revogrid-source') {
    return '';
  }

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
