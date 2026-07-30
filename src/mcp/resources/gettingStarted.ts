import type { Framework } from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { formatSearchResult } from '../../services/resultFormatting.js';

export async function readGettingStartedResource(
  framework: Framework,
  services: AppServices,
) {
  const results = await services.searchService.searchDocs('getting started', {
    framework,
    docTypes: ['guide'],
    limit: 3
  });

  return results.map(formatSearchResult);
}
