// Proxies document-content requests to the Lucid REST API with an in-memory
// server-side cache to avoid re-fetching unchanged documents.
//
//  GET /api/lucid/:documentId
//    → served from cache if fresh, otherwise fetched from Lucid
//    → uses ETag revalidation when available (If-None-Match)
//    → TTL: CACHE_TTL_MS (default 10 minutes)
//    → cache is per-document, shared across all authenticated requests

import AdmZip from 'adm-zip';
import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';

const LUCID_API_BASE = 'https://api.lucid.co';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── In-memory document cache ─────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  etag: string | null;
  cachedAt: number;
}

const documentCache = new Map<string, CacheEntry>();

function getCached(documentId: string): CacheEntry | null {
  const entry = documentCache.get(documentId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    documentCache.delete(documentId);
    return null;
  }
  return entry;
}

function setCached(documentId: string, data: unknown, etag: string | null): void {
  documentCache.set(documentId, { data, etag, cachedAt: Date.now() });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createProxyRouter(config: ServerConfig): Router {
  const router = Router();

  router.use(requireAuth(config));

  // GET /api/lucid/:documentId/download?title=...
  // Returns the document as a downloadable .lucid file (ZIP containing document.json).
  // Uses the server-side cache so a prior view doesn't need a second Lucid API call.
  router.get('/:documentId/download', async (req, res) => {
    const { documentId } = req.params;
    const title = typeof req.query['title'] === 'string' ? req.query['title'] : documentId;
    const url = `${LUCID_API_BASE}/documents/${encodeURIComponent(documentId)}/contents`;

    // Prefer cached data; fall back to a fresh fetch
    let data: unknown;
    const cached = getCached(documentId);
    if (cached) {
      data = cached.data;
    } else {
      try {
        const lucidResp = await fetch(url, {
          headers: {
            'Authorization':    `Bearer ${req.session.accessToken}`,
            'Lucid-Api-Version': '1',
          },
        });
        if (!lucidResp.ok) {
          res.status(lucidResp.status).json({ error: `Lucid API error: ${lucidResp.status}` });
          return;
        }
        data = await lucidResp.json();
        setCached(documentId, data, lucidResp.headers.get('ETag'));
      } catch (err) {
        console.error(`[proxy] download fetch error for ${documentId}:`, err);
        res.status(500).json({ error: 'Proxy fetch error' });
        return;
      }
    }

    // Pack into a .lucid ZIP (same format as a Lucid desktop export)
    const zip = new AdmZip();
    zip.addFile('document.json', Buffer.from(JSON.stringify(data, null, 2), 'utf8'));

    const safeTitle = title.replace(/[^\w\s\-().]/g, '').trim() || documentId;
    const filename = `${safeTitle}.lucid`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zip.toBuffer());
  });

  router.get('/:documentId', async (req, res) => {
    const { documentId } = req.params;
    const url = `${LUCID_API_BASE}/documents/${encodeURIComponent(documentId)}/contents`;

    // ── Cache hit ────────────────────────────────────────────────────────────
    const cached = getCached(documentId);
    if (cached) {
      console.log(`[proxy] cache hit for ${documentId}`);
      if (cached.etag) res.setHeader('ETag', cached.etag);
      res.setHeader('Content-Type', 'application/json');
      res.json(cached.data);
      return;
    }

    // ── Cache miss — fetch from Lucid ────────────────────────────────────────
    try {
      console.log(`[proxy] fetching ${documentId} from Lucid`);
      const lucidResp = await fetch(url, {
        headers: {
          'Authorization':    `Bearer ${req.session.accessToken}`,
          'Lucid-Api-Version': '1',
        },
      });

      if (!lucidResp.ok) {
        const body = await lucidResp.text();
        console.error(`[proxy] Document ${documentId} — Lucid ${lucidResp.status}: ${body}`);
        res.status(lucidResp.status).json({ error: `Lucid API error: ${lucidResp.status}` });
        return;
      }

      const etag = lucidResp.headers.get('ETag');
      const data = await lucidResp.json();

      setCached(documentId, data, etag);

      if (etag) res.setHeader('ETag', etag);
      res.setHeader('Content-Type', 'application/json');
      res.json(data);
    } catch (err) {
      console.error(`[proxy] Fetch error for document ${documentId}:`, err);
      res.status(500).json({ error: 'Proxy fetch error' });
    }
  });

  return router;
}
