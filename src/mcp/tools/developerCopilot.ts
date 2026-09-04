import {
  InspectRevogridApiInputSchema,
  InspectRevogridApiOutputSchema,
  ListRevogridCapabilitiesInputSchema,
  ListRevogridCapabilitiesOutputSchema,
  PlanRevogridImplementationInputSchema,
  PlanRevogridImplementationOutputSchema,
  ValidateRevogridUsageInputSchema,
  ValidateRevogridUsageOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';

export async function handleListRevogridCapabilities(rawInput: unknown, services: AppServices) {
  const input = ListRevogridCapabilitiesInputSchema.parse(rawInput);
  return ListRevogridCapabilitiesOutputSchema.parse(
    await services.developerService.listCapabilities(input),
  );
}

export async function handleInspectRevogridApi(rawInput: unknown, services: AppServices) {
  const input = InspectRevogridApiInputSchema.parse(rawInput);
  const result = await services.developerService.inspectApi(input.query, input);
  return InspectRevogridApiOutputSchema.parse({
    status: result.match ? 'found' : result.candidates.length > 0 ? 'ambiguous' : 'not-found',
    match: result.match,
    candidates: result.candidates,
    correction: result.match
      ? undefined
      : result.candidates.length > 0
        ? 'Specify packageName to select one supported export.'
        : 'Use list_revogrid_capabilities or search_revogrid_docs to discover a supported public name.'
  });
}

export async function handlePlanRevogridImplementation(rawInput: unknown, services: AppServices) {
  const input = PlanRevogridImplementationInputSchema.parse(rawInput);
  return PlanRevogridImplementationOutputSchema.parse(
    await services.developerService.planImplementation({
      ...input,
      capabilities: [...input.requiredCapabilities, ...(input.capabilities ?? [])]
    }),
  );
}

export async function handleValidateRevogridUsage(rawInput: unknown, services: AppServices) {
  const input = ValidateRevogridUsageInputSchema.parse(rawInput);
  return ValidateRevogridUsageOutputSchema.parse(
    await services.developerService.validateUsage(input),
  );
}
