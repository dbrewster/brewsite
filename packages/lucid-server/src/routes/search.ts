// Proxies document search requests to the Lucid REST API.
//
// POST /api/lucid/search
//   Body: { keywords?, product?, pageSize?, pageToken? }
//   → POST https://api.lucid.co/documents/search
//   → Returns { documents: LucidDocumentSummary[], nextPageToken: string | null }
//
// Notes:
//   - product must be an array of strings (e.g. ["lucidchart"]), not a plain string.
//   - pageSize and pageToken are query params, not body fields.
//   - The Lucid response shape is parsed defensively: documents may be under
//     "documents", "items", or at the array root depending on API version.

import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';

const LUCID_SEARCH_URL = 'https://api.lucid.co/documents/search';

interface LucidSearchBody {
  keywords?: string;
  product?: string;
  pageSize?: number;
  pageToken?: string;
}

export function createSearchRouter(config: ServerConfig): Router {
  const router = Router();

  router.use(requireAuth(config));

  router.post('/', async (req, res) => {
    const body = req.body as LucidSearchBody;
    const accessToken = req.session.accessToken!;

    // product must be an array; pageSize/pageToken are query params only
    const lucidBody: Record<string, unknown> = {};
    if (body.keywords?.trim()) lucidBody['keywords'] = body.keywords.trim();
    if (body.product && body.product !== 'all') lucidBody['product'] = [body.product];

    const queryParams = new URLSearchParams();
    queryParams.set('pageSize', String(Math.min(body.pageSize ?? 50, 200)));
    if (body.pageToken) queryParams.set('pageToken', body.pageToken);
    const url = `${LUCID_SEARCH_URL}?${queryParams.toString()}`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization':    `Bearer ${accessToken}`,
          'Lucid-Api-Version': '1',
          'Content-Type':     'application/json',
        },
        body: JSON.stringify(lucidBody),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error(`[search] Lucid API error (${resp.status}): ${text}`);
        res.status(resp.status).json({ error: `Lucid API error: ${resp.status}` });
        return;
      }

      // Parse defensively: Lucid may return documents under "documents",
      // "items", or as a plain root array depending on API version.
      const data = await resp.json() as Record<string, unknown>;
      const documents = Array.isArray(data['documents'])
        ? data['documents']
        : Array.isArray(data['items'])
          ? data['items']
          : Array.isArray(data)
            ? data
            : [];

      res.json({
        documents,
        nextPageToken: extractNextPageToken(resp.headers.get('Link')),
      });
    } catch (err) {
      console.error('[search] fetch error:', err);
      res.status(500).json({ error: 'Search proxy error' });
    }
  });

  return router;
}

function extractNextPageToken(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  if (!match) return null;
  try {
    return new URL(match[1]).searchParams.get('pageToken');
  } catch {
    return null;
  }
}
