import type { AppServices, RequestContext } from '../../types/catalog.js';

export async function readFeatureMatrixResource(
  services: AppServices,
  context: RequestContext,
) {
  const features = await services.featureService.listFeatures(context.entitlement);

  return features.map((feature) => ({
    featureName: feature.featureName,
    supported: feature.supported,
    requiresPro: feature.requiresPro,
    stability: feature.stability,
    supportedFrameworks: feature.supportedFrameworks,
    notes: feature.notes,
    fallbackApproach: feature.fallbackApproach
  }));
}
