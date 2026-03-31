import type { Framework } from '@revogrid-mcp/content-model';

import type { AppServices, RequestContext } from '../../types/catalog.js';
import { formatSearchResult } from '../../services/resultFormatting.js';

export async function readGettingStartedResource(
  framework: Framework,
  services: AppServices,
  context: RequestContext,
) {
  const results = await services.searchService.searchDocs('getting started', {
    framework,
    docTypes: ['guide'],
    limit: 3,
    entitlement: context.entitlement
  });

  return results.map(formatSearchResult);
}
