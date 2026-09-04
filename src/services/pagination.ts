import { createHash } from 'node:crypto';

export class InvalidCursorError extends Error {
  public constructor(message = 'The cursor is invalid, stale, or belongs to different filters.') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

export function encodePageCursor(
  offset: number,
  scope: string,
  context: unknown,
): string {
  return Buffer.from(JSON.stringify({
    version: 1,
    offset,
    fingerprint: cursorFingerprint(scope, context)
  })).toString('base64url');
}

export function decodePageCursor(
  cursor: string | undefined,
  scope: string,
  context: unknown,
): number {
  if (!cursor) return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('offset' in parsed) ||
      !Number.isSafeInteger(parsed.offset) ||
      Number(parsed.offset) < 0 ||
      !('fingerprint' in parsed) ||
      parsed.fingerprint !== cursorFingerprint(scope, context)
    ) {
      throw new InvalidCursorError();
    }
    return Number(parsed.offset);
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error;
    throw new InvalidCursorError();
  }
}

function cursorFingerprint(scope: string, context: unknown): string {
  return createHash('sha256')
    .update(`${scope}:${stableStringify(context)}`)
    .digest('base64url')
    .slice(0, 22);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
