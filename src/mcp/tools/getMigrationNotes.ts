import {
  GetMigrationNotesInputSchema,
  GetMigrationNotesOutputSchema
} from '@revogrid-mcp/content-model';

import type { AppServices } from '../../types/catalog.js';
import { formatExampleResult, formatSearchResult } from '../../services/resultFormatting.js';

export async function handleGetMigrationNotes(
  rawInput: unknown,
  services: AppServices,
) {
  const input = GetMigrationNotesInputSchema.parse(rawInput);
  const resolution = await services.migrationService.resolveMigration(
    input.fromVersion,
    input.toVersion,
    {
      framework: input.framework
    },
  );

  if (!resolution.migration) {
    return GetMigrationNotesOutputSchema.parse({
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      framework: input.framework,
      breakingChanges: [],
      renamedSymbols: [],
      changedDefaults: [],
      packageChanges: [],
      recommendedDocs: [],
      recommendedExamples: []
    });
  }

  return GetMigrationNotesOutputSchema.parse({
    fromVersion: resolution.migration.fromVersion,
    toVersion: resolution.migration.toVersion,
    framework: input.framework,
    breakingChanges: resolution.migration.breakingChanges,
    renamedSymbols: resolution.migration.renamedSymbols,
    changedDefaults: resolution.migration.changedDefaults,
    packageChanges: resolution.migration.packageChanges,
    recommendedDocs: resolution.docs.map(formatSearchResult),
    recommendedExamples: resolution.examples.map(formatExampleResult)
  });
}
