import * as vscode from 'vscode';

const PROVIDER_ID = 'revogrid.mcpServers';
const EXTENSION_VERSION = '0.1.0';
const PUBLIC_SERVER_LABEL = 'RevoGrid DataGrid MCP';
const PRO_SERVER_LABEL = 'RevoGrid DataGrid MCP Pro';
const PUBLIC_SERVER_URL = 'https://mcp.rv-grid.com';
const PRO_SERVER_URL = 'https://mcp.rv-grid.com/pro';
const PRO_TOKEN_SECRET_KEY = 'revogrid.mcp.proBearerToken';

export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> = {
    provideMcpServerDefinitions: () => [
      new vscode.McpHttpServerDefinition(
        PUBLIC_SERVER_LABEL,
        vscode.Uri.parse(PUBLIC_SERVER_URL),
        undefined,
        EXTENSION_VERSION,
      ),
      new vscode.McpHttpServerDefinition(
        PRO_SERVER_LABEL,
        vscode.Uri.parse(PRO_SERVER_URL),
        undefined,
        EXTENSION_VERSION,
      )
    ],
    resolveMcpServerDefinition: async (server, token) => {
      if (server.label !== PRO_SERVER_LABEL) {
        return server;
      }

      const bearerToken = await getProBearerToken(context, token);
      if (!bearerToken) {
        return undefined;
      }

      server.headers = {
        ...server.headers,
        Authorization: `Bearer ${bearerToken}`
      };

      return server;
    }
  };

  context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider));
}

async function getProBearerToken(context: vscode.ExtensionContext, token: vscode.CancellationToken) {
  const storedToken = await context.secrets.get(PRO_TOKEN_SECRET_KEY);
  if (storedToken) {
    return storedToken;
  }

  if (token.isCancellationRequested) {
    return undefined;
  }

  const enteredToken = await vscode.window.showInputBox({
    title: 'RevoGrid DataGrid MCP Pro',
    prompt: 'Enter your RevoGrid DataGrid MCP Pro bearer token.',
    placeHolder: 'Bearer token',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length > 0 ? undefined : 'Enter a bearer token.')
  });

  const normalizedToken = normalizeBearerToken(enteredToken);
  if (!normalizedToken || token.isCancellationRequested) {
    return undefined;
  }

  await context.secrets.store(PRO_TOKEN_SECRET_KEY, normalizedToken);
  return normalizedToken;
}

function normalizeBearerToken(value: string | undefined) {
  const token = value?.trim();
  return token?.replace(/^Bearer\s+/i, '').trim();
}

export function deactivate() {
  // No extension-owned resources need explicit shutdown.
}
