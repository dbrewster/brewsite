// Browser-side client for the Lucid document proxy and search proxy.
// Calls /api/lucid/* which is proxied to lucid-server in development.
// Returns structured data; never touches localStorage directly.

import type { LucidDocumentJSON, LucidPageJSON } from './types';
import type { LucidSearchRequest, LucidSearchResponse } from './searchTypes';
import { selectLucidPage } from './converter';

// ─── Error types ──────────────────────────────────────────────────────────────

export class LucidAuthError extends Error {
  constructor() {
    super('Not authenticated with Lucid. Redirect to /auth/login.');
    this.name = 'LucidAuthError';
  }
}

export class LucidFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LucidFetchError';
  }
}

// ─── Document content fetch ────────────────────────────────────────────────────

export interface LucidFetchResult {
  readonly page: LucidPageJSON;
  /** ETag from the server response, or '' if not provided. Used as cache key component. */
  readonly etag: string;
}

/**
 * Fetches a single page of a Lucid document from the proxy server.
 *
 * @param documentId - The Lucid document ID (from the document's URL)
 * @param pageIndex - Zero-based page index within the document
 * @param signal - Optional AbortSignal for cancellation
 * @throws {LucidAuthError} if the session is not authenticated (HTTP 401)
 * @throws {LucidFetchError} for other non-OK HTTP responses
 */
export async function fetchLucidPage(
  documentId: string,
  pageIndex: number,
  signal?: AbortSignal,
): Promise<LucidFetchResult> {
  const url = `/api/lucid/${encodeURIComponent(documentId)}`;
  const response = await fetch(url, {
    credentials: 'include',
    signal,
  });

  if (response.status === 401) throw new LucidAuthError();
  if (!response.ok) {
    throw new LucidFetchError(response.status, `Lucid proxy error: ${response.status}`);
  }

  const doc = await response.json() as LucidDocumentJSON;
  const etag = response.headers.get('ETag') ?? '';

  const page = selectLucidPage(doc, pageIndex);
  if (!page) {
    throw new LucidFetchError(422, `Document has no page at index ${pageIndex}`);
  }

  return { page, etag };
}

// ─── Document search ──────────────────────────────────────────────────────────

/**
 * Searches the authenticated user's Lucid documents via the proxy server.
 * Maps to POST /api/lucid/search on the proxy, which forwards to
 * POST https://api.lucid.co/documents/search with the session Bearer token.
 *
 * @param request - Search parameters (keywords, product filter, pagination)
 * @param signal - Optional AbortSignal for cancellation
 * @throws {LucidAuthError} if the session is not authenticated (HTTP 401)
 * @throws {LucidFetchError} for other non-OK HTTP responses
 */
export async function searchLucidDocuments(
  request: LucidSearchRequest = {},
  signal?: AbortSignal,
): Promise<LucidSearchResponse> {
  // Normalise: treat 'all' as absent (Lucid API doesn't accept 'all')
  const body: Record<string, unknown> = {
    pageSize: request.pageSize ?? 20,
  };
  if (request.keywords?.trim()) body['keywords'] = request.keywords.trim();
  if (request.product && request.product !== 'all') body['product'] = request.product;
  if (request.pageToken) body['pageToken'] = request.pageToken;

  const response = await fetch('/api/lucid/search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 401) throw new LucidAuthError();
  if (!response.ok) {
    throw new LucidFetchError(response.status, `Lucid search error: ${response.status}`);
  }

  return response.json() as Promise<LucidSearchResponse>;
}

// ─── Auth status ───────────────────────────────────────────────────────────────

/**
 * Checks whether the browser session is currently authenticated with Lucid.
 * Safe to call on every page load — never throws.
 */
export async function checkLucidAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch('/auth/status', { credentials: 'include' });
    if (!response.ok) return false;
    const data = await response.json() as { authenticated: boolean };
    return data.authenticated;
  } catch {
    return false;
  }
}
