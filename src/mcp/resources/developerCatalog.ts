import {
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer
} from '@modelcontextprotocol/server';

import type { AppServices } from '../../types/catalog.js';

export function registerDeveloperCatalogResources(server: McpServer, services: AppServices): void {
  registerTemplate(server, 'capability', 'revogrid://capabilities/{id}', async (id) =>
    services.developerService.getCapability(id),
  );
  registerTemplate(server, 'symbol', 'revogrid://symbols/{qualifiedName}', async (qualifiedName) => {
    const result = await services.developerService.inspectApi(qualifiedName, {});
    return result.match ?? { candidates: result.candidates };
  });
  registerTemplate(server, 'package', 'revogrid://packages/{packageName}', async (packageName) =>
    services.developerService.getPackage(packageName),
  );
  registerTemplate(server, 'example', 'revogrid://examples/{id}', async (id) =>
    services.developerService.getExample(id),
  );
}

function registerTemplate(
  server: McpServer,
  name: string,
  template: string,
  read: (value: string) => Promise<unknown>,
): void {
  const variable = template.match(/\{([^}]+)\}/)?.[1];
  if (!variable) throw new Error(`Resource template ${template} has no variable.`);
  server.registerResource(
    `revogrid-${name}`,
    new ResourceTemplate(template, { list: undefined }),
    {
      title: `RevoGrid ${name}`,
      description: `Source-grounded RevoGrid ${name} catalog record.`,
      mimeType: 'application/json',
      cacheHint: { ttlMs: 60_000, cacheScope: 'public' }
    },
    async (uri, variables) => {
      const value = String(variables[variable] ?? '');
      const payload = await read(decodeURIComponent(value));
      if (payload === null) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(payload) }]
      };
    },
  );
}
