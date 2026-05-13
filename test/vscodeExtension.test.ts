import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMock = vi.hoisted(() => {
  class McpHttpServerDefinition {
    constructor(
      public label: string,
      public uri: { value: string },
      public headers: Record<string, string> | undefined,
      public version: string,
    ) {}
  }

  return {
    lm: {
      registerMcpServerDefinitionProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    window: {
      showInputBox: vi.fn(),
    },
    Uri: {
      parse: vi.fn((value: string) => ({ value })),
    },
    McpHttpServerDefinition,
  };
});

vi.mock('vscode', () => vscodeMock);

describe('VS Code MCP extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose or request bearer auth in the public package', async () => {
    const { activate } = await import('../src/vscode/extension.ts');
    const secrets = {
      get: vi.fn(),
      store: vi.fn(),
    };
    const context = {
      extension: {
        packageJSON: {
          name: 'revogrid-datagrid-mcp',
          version: '1.2.3',
        },
      },
      secrets,
      subscriptions: [],
    };

    activate(context as never);

    expect(vscodeMock.lm.registerMcpServerDefinitionProvider).toHaveBeenCalledWith(
      'revogrid.mcpServers',
      expect.any(Object),
    );

    const provider = vscodeMock.lm.registerMcpServerDefinitionProvider.mock.calls[0][1];
    const definitions = provider.provideMcpServerDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].label).toBe('RevoGrid DataGrid MCP');

    const proLabeledServer = {
      label: 'RevoGrid DataGrid MCP Pro',
      headers: {},
    };
    const resolved = await provider.resolveMcpServerDefinition(proLabeledServer, {
      isCancellationRequested: false,
    });

    expect(resolved).toBe(proLabeledServer);
    expect(proLabeledServer.headers).toEqual({});
    expect(secrets.get).not.toHaveBeenCalled();
    expect(vscodeMock.window.showInputBox).not.toHaveBeenCalled();
  });

  it('requests bearer auth only for the Pro package definition', async () => {
    const { activate } = await import('../src/vscode/extension.ts');
    const secrets = {
      get: vi.fn(async () => 'stored-token'),
      store: vi.fn(),
    };
    const context = {
      extension: {
        packageJSON: {
          name: 'revogrid-datagrid-mcp-pro',
          version: '1.2.3',
        },
      },
      secrets,
      subscriptions: [],
    };

    activate(context as never);

    expect(vscodeMock.lm.registerMcpServerDefinitionProvider).toHaveBeenCalledWith(
      'revogrid.proMcpServers',
      expect.any(Object),
    );

    const provider = vscodeMock.lm.registerMcpServerDefinitionProvider.mock.calls[0][1];
    const definitions = provider.provideMcpServerDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].label).toBe('RevoGrid DataGrid MCP Pro');

    const resolved = await provider.resolveMcpServerDefinition(definitions[0], {
      isCancellationRequested: false,
    });

    expect(secrets.get).toHaveBeenCalledWith('revogrid.mcp.proBearerToken');
    expect(vscodeMock.window.showInputBox).not.toHaveBeenCalled();
    expect(resolved.headers).toEqual({ Authorization: 'Bearer stored-token' });
  });
});
