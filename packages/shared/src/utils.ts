import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

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

export function resolveWorkspaceRoot(fromFileUrl: string): string {
  return path.resolve(fileURLToPath(new URL('../../../../', fromFileUrl)));
}

export function resolveFromWorkspace(fromFileUrl: string, relativePath: string): string {
  return path.resolve(resolveWorkspaceRoot(fromFileUrl), relativePath);
}

export function resolveParentRepoRoot(fromFileUrl: string): string {
  return path.resolve(resolveWorkspaceRoot(fromFileUrl), '..');
}

export function resolveFromParentRepo(fromFileUrl: string, relativePath: string): string {
  return path.resolve(resolveParentRepoRoot(fromFileUrl), relativePath);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
