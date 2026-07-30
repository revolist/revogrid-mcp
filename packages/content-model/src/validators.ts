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
