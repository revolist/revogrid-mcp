import * as vscode from 'vscode';

const PUBLIC_PROVIDER_ID = 'revogrid.mcpServers';
const PRO_PROVIDER_ID = 'revogrid.proMcpServers';
const PRO_PACKAGE_NAME = 'revogrid-datagrid-mcp-pro';
const PUBLIC_SERVER_LABEL = 'RevoGrid DataGrid MCP';
const PRO_SERVER_LABEL = 'RevoGrid DataGrid MCP Pro';
const PUBLIC_SERVER_URL = 'https://mcp.rv-grid.com';
const PRO_SERVER_URL = 'https://mcp.rv-grid.com/pro';
const PRO_TOKEN_SECRET_KEY = 'revogrid.mcp.proBearerToken';
type PackageVariant = 'public' | 'pro';

export function activate(context: vscode.ExtensionContext) {
  const variant = resolvePackageVariant(context);
  const extensionVersion = resolveExtensionVersion(context);
  const provider: vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> = {
    provideMcpServerDefinitions: () => createServerDefinitions(variant, extensionVersion),
    resolveMcpServerDefinition: async (server, token) => {
      if (variant !== 'pro' || server.label !== PRO_SERVER_LABEL) {
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

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(resolveProviderId(variant), provider),
  );
}

function createServerDefinitions(variant: PackageVariant, extensionVersion: string) {
  if (variant === 'pro') {
    return [
      new vscode.McpHttpServerDefinition(
        PRO_SERVER_LABEL,
        vscode.Uri.parse(PRO_SERVER_URL),
        undefined,
        extensionVersion,
      )
    ];
  }

  return [
    new vscode.McpHttpServerDefinition(
      PUBLIC_SERVER_LABEL,
      vscode.Uri.parse(PUBLIC_SERVER_URL),
      undefined,
      extensionVersion,
    )
  ];
}

function resolveProviderId(variant: PackageVariant) {
  return variant === 'pro' ? PRO_PROVIDER_ID : PUBLIC_PROVIDER_ID;
}

function resolvePackageVariant(context: vscode.ExtensionContext): PackageVariant {
  const packageJson = context.extension.packageJSON as {
    name?: string;
    revogridMcpVariant?: string;
  };

  return packageJson.name === PRO_PACKAGE_NAME || packageJson.revogridMcpVariant === 'pro'
    ? 'pro'
    : 'public';
}

function resolveExtensionVersion(context: vscode.ExtensionContext) {
  const packageJson = context.extension.packageJSON as {
    version?: string;
  };

  return packageJson.version ?? '0.0.0';
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
