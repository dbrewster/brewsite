// Proxies folder-contents requests to the Lucid REST API.
// Requires folder:readonly OAuth scope.
//
//  GET /api/lucid/folders/:id/contents
//    → GET https://api.lucid.co/folders/:id/contents
//    Accepts special IDs: "root" returns the user's top-level folder tree,
//    which includes both owned folders and shared-with-me folders.
//
// This module also exports fetchFolderContents() for use by search.ts so it
// can merge shared documents into the search results server-side.

import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';

const LUCID_API_BASE = 'https://api.lucid.co';

// ─── Shared types ─────────────────────────────────────────────────────────────

/** Minimal document shape as returned by the folder contents endpoint. */
export interface FolderDocument {
  documentId: string;
  title: string;
  product?: string;
  created?: string;
  lastModified?: string;
  editUrl?: string;
  viewUrl?: string;
  canEdit?: boolean;
  pageCount?: number;
  [key: string]: unknown;
}

/** Minimal folder shape as returned by the folder contents endpoint. */
export interface FolderEntry {
  folderId: string;
  name?: string;
  [key: string]: unknown;
}

export interface FolderContentsResponse {
  documents: FolderDocument[];
  folders: FolderEntry[];
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

/**
 * Fetches the contents of a Lucid folder by ID.
 * Returns normalised { documents, folders } regardless of response structure.
 * Returns empty arrays on any error — this is used speculatively in search merges.
 */
export async function fetchFolderContents(
  folderId: string,
  accessToken: string,
): Promise<FolderContentsResponse> {
  const url = `${LUCID_API_BASE}/folders/${encodeURIComponent(folderId)}/contents`;
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization':    `Bearer ${accessToken}`,
        'Lucid-Api-Version': '1',
      },
    });
    if (!resp.ok) {
      console.warn(`[folders] GET /folders/${folderId}/contents → ${resp.status}`);
      return { documents: [], folders: [] };
    }
    const data = await resp.json() as Record<string, unknown>;
    return normalise(data);
  } catch (err) {
    console.warn(`[folders] fetch error for folder ${folderId}:`, err);
    return { documents: [], folders: [] };
  }
}

/**
 * Walks the root folder tree one level deep and collects all documents
 * found in the root folder itself and each immediate sub-folder.
 *
 * This surfaces documents shared with the user, which the /documents/search
 * endpoint doesn't return. We cap sub-folder expansion at MAX_FOLDER_DEPTH
 * to avoid unbounded API calls.
 */
export async function fetchAllAccessibleDocuments(
  accessToken: string,
): Promise<FolderDocument[]> {
  const MAX_SUB_FOLDERS = 8; // cap parallel folder fetches

  const root = await fetchFolderContents('root', accessToken);
  const allDocs: FolderDocument[] = [...root.documents];

  // Fan out to sub-folders in parallel, capped to avoid rate-limiting
  const subFolderIds = root.folders
    .slice(0, MAX_SUB_FOLDERS)
    .map((f) => f.folderId);

  const subResults = await Promise.all(
    subFolderIds.map((id) => fetchFolderContents(id, accessToken)),
  );
  for (const result of subResults) {
    allDocs.push(...result.documents);
  }

  return allDocs;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Normalises the folder contents API response, which can vary in structure
 * across Lucid API versions. Extracts documents and sub-folders defensively.
 */
function normalise(data: Record<string, unknown>): FolderContentsResponse {
  const documents: FolderDocument[] = [];
  const folders: FolderEntry[] = [];

  // Documents may be at data.documents or data.items filtered by type
  const rawDocs = Array.isArray(data['documents']) ? data['documents'] as unknown[] : [];
  const rawItems = Array.isArray(data['items']) ? data['items'] as unknown[] : [];

  for (const item of [...rawDocs, ...rawItems]) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj['documentId'] === 'string') {
      documents.push(obj as FolderDocument);
    } else if (typeof obj['folderId'] === 'string') {
      folders.push(obj as FolderEntry);
    }
  }

  // Folders may also be at data.folders
  const rawFolders = Array.isArray(data['folders']) ? data['folders'] as unknown[] : [];
  for (const f of rawFolders) {
    if (!f || typeof f !== 'object') continue;
    const obj = f as Record<string, unknown>;
    if (typeof obj['folderId'] === 'string') {
      folders.push(obj as FolderEntry);
    }
  }

  return { documents, folders };
}

// ─── Express router ───────────────────────────────────────────────────────────

export function createFoldersRouter(config: ServerConfig): Router {
  const router = Router();
  router.use(requireAuth(config));

  // GET /api/lucid/folders/:id/contents
  router.get('/:id/contents', async (req, res) => {
    const { documents, folders } = await fetchFolderContents(
      req.params['id'],
      req.session.accessToken!,
    );
    res.json({ documents, folders });
  });

  return router;
}
