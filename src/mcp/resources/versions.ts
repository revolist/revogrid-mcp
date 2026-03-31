import type { AppServices, RequestContext } from '../../types/catalog.js';

export async function readLatestVersionResource(
  services: AppServices,
  context: RequestContext,
) {
  void context;
  const versions = await services.contentRepository.getVersions();
  return versions.find((version) => version.latest) ?? versions[0] ?? null;
}

export async function readAllVersionsResource(
  services: AppServices,
  context: RequestContext,
) {
  void context;
  return services.contentRepository.getVersions();
}
