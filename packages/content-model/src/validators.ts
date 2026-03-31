import type { Entitlement } from './enums.js';
import type { DocumentChunk } from './schema.js';

export function normalizeVersion(version: string | undefined): string | undefined {
  if (!version) {
    return undefined;
  }

  return version.trim().replace(/^v/i, '');
}

export function sanitizeLimit(limit: number | undefined, fallback = 5): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 20);
}

export function canAccessChunk(chunk: DocumentChunk, entitlement: Entitlement): boolean {
  if (!chunk.requiresPro) {
    return true;
  }

  return entitlement === 'paid_pro' || entitlement === 'internal_admin' || entitlement === 'trial';
}
