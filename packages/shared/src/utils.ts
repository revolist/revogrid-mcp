import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9_@.-]+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function stableHash(value: string): number {
  let hash = 0;

  for (const char of value) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function resolveRepoRoot(fromFileUrl: string): string {
  return path.resolve(fileURLToPath(new URL('../../../../', fromFileUrl)));
}

export function resolveFromRepo(fromFileUrl: string, relativePath: string): string {
  return path.resolve(resolveRepoRoot(fromFileUrl), relativePath);
}
