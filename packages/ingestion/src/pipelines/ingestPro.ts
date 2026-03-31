import { buildSeedDataset } from '../fixtures/seedData.js';

export function ingestFullSeedContent() {
  // TODO(revogrid-real-ingestion): merge parsed Pro docs and demos from ../revogrid/docs/pro and ../revogrid-pro/src into the normalized chunk model.
  return buildSeedDataset();
}
