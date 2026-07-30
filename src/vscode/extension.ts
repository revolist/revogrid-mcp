import * as vscode from 'vscode';

const PUBLIC_PROVIDER_ID = 'revogrid.mcpServers';
const PUBLIC_SERVER_LABEL = 'RevoGrid DataGrid MCP';
const PUBLIC_SERVER_URL = 'https://mcp.rv-grid.com';

export function activate(context: vscode.ExtensionContext) {
  const extensionVersion = resolveExtensionVersion(context);
  const provider: vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> = {
    provideMcpServerDefinitions: () => createServerDefinitions(extensionVersion),
    resolveMcpServerDefinition: (server) => server
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PUBLIC_PROVIDER_ID, provider),
  );
}

function createServerDefinitions(extensionVersion: string) {
  return [
    new vscode.McpHttpServerDefinition(
      PUBLIC_SERVER_LABEL,
      vscode.Uri.parse(PUBLIC_SERVER_URL),
      undefined,
      extensionVersion,
    )
  ];
}

function resolveExtensionVersion(context: vscode.ExtensionContext) {
  const packageJson = context.extension.packageJSON as {
    version?: string;
  };

  return packageJson.version ?? '0.0.0';
}

export function deactivate() {
  // No extension-owned resources need explicit shutdown.
}
