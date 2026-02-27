// Browser-side DiagramState cache backed by localStorage.
// Serializes/deserializes compiled DiagramState objects keyed by
// document ID, page index, and ETag.
//
// Storage budget: a typical 50-node DiagramState is ~80–150 KB as JSON.
// localStorage limit is ~5 MB. The cache logs a warning if total lucid cache
// usage exceeds 4 MB.

import type { DiagramState } from '../elements/diagram/types';

const KEY_PREFIX = 'lucid_cache:';
const WARN_BYTES = 4 * 1024 * 1024; // 4 MB

interface CachedEntry {
  readonly etag: string;
  readonly state: DiagramState;
  readonly cachedAt: number; // unix ms
}

/**
 * Returns the localStorage key for a given document / page / etag combo.
 */
export function buildCacheKey(
  documentId: string,
  pageIndex: number,
  etag: string,
): string {
  return `${KEY_PREFIX}${documentId}:${pageIndex}:${etag}`;
}

/**
 * Reads a compiled DiagramState from the cache.
 * Returns null on miss, or if the stored value is corrupted (entry is evicted).
 */
export function readCachedDiagramState(
  documentId: string,
  pageIndex: number,
  etag: string,
): DiagramState | null {
  const key = buildCacheKey(documentId, pageIndex, etag);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    return entry.state ?? null;
  } catch {
    localStorage.removeItem(key); // evict corrupted entry
    return null;
  }
}

/**
 * Writes a compiled DiagramState to the cache.
 * Silently no-ops if localStorage is unavailable (private browsing, quota exceeded).
 * Logs a warning when total lucid cache usage exceeds WARN_BYTES.
 */
export function writeCachedDiagramState(
  documentId: string,
  pageIndex: number,
  etag: string,
  state: DiagramState,
): void {
  const key   = buildCacheKey(documentId, pageIndex, etag);
  const entry: CachedEntry = { etag, state, cachedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
    checkBudget();
  } catch (err) {
    console.warn('[lucid/cache] localStorage write failed:', err);
  }
}

/**
 * Removes all cache entries whose key starts with `lucid_cache:{documentId}:{pageIndex}:`,
 * regardless of ETag. Call before writing a new entry for the same document/page
 * to avoid accumulating stale-etag entries.
 */
export function evictCachedDocument(documentId: string, pageIndex: number): void {
  const prefix = `${KEY_PREFIX}${documentId}:${pageIndex}:`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) localStorage.removeItem(k);
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function checkBudget(): void {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(KEY_PREFIX)) {
      total += (localStorage.getItem(k)?.length ?? 0) * 2; // UTF-16 chars → bytes approx
    }
  }
  if (total > WARN_BYTES) {
    console.warn(
      `[lucid/cache] Cache exceeds ${WARN_BYTES / 1024 / 1024} MB. ` +
      'Consider calling evictCachedDocument() to free space.',
    );
  }
}
