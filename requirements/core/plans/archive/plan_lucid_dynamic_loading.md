---
title: "Dynamic Lucid Document Loading with OAuth"
doc_type: plan
owner: architecture
status: complete
updated: 2026-02-26
---

# Dynamic Lucid Document Loading with OAuth

## Overview

Replace the build-time `import-lucid.mjs` script with a fully dynamic pipeline: the
presenter authenticates with their Lucid account once before the presentation, and all
`<LucidDiagram>` elements fetch, convert, compile, and cache their document content at
runtime. A local Express server handles the OAuth Authorization Code flow and proxies
API calls. Compiled `DiagramState` is cached in `localStorage` keyed by document ID,
page index, and ETag so repeated loads are instant.

---

## 1. Scope

**New packages / directories created:**

| Location | Purpose |
|---|---|
| `packages/lucid-server/` | New Node.js + Express package: OAuth handler + Lucid API proxy |
| `packages/diagram/src/lucid/` | New module in `@brewsite/diagram`: Lucid API types, converter, client, cache |
| `packages/diagram/src/elements/lucid-diagram/` | New element module: `<LucidDiagram>` DSL + compile + widget |

**Files modified:**

| File | Change |
|---|---|
| `pnpm-workspace.yaml` | Already covers `packages/*` — no change needed |
| `turbo.json` | Add `dev:server` task |
| `apps/examples/vite.config.ts` | Add `/auth` and `/api/lucid` proxy to port 3001 |
| `apps/examples/vite-app/App.tsx` | Add `/lucid-diagram` route |
| `packages/diagram/src/index.ts` | Re-export `LucidDiagram` DSL and types |
| `packages/diagram/src/compiler/handlers.ts` | Register `LucidDiagram` compiler handler |

---

## 2. Architectural Principles

- The **server package is a dev tool only**. It holds the OAuth `client_secret` in
  `process.env` (read from a local `.env` file excluded from git). Production
  deployments replace it with a proper edge function; the browser-side code is
  production-agnostic.
- The **converter is a pure function** — a browser-compatible port of `import-lucid.mjs`
  that takes raw Lucid page JSON and returns a `DiagramDSL`. No Node.js APIs. No ZIP.
  No HJSON.
- **`compileDiagram(dsl)` is called in the browser** at runtime after conversion. This
  is already a pure function with no build-time dependencies.
- **`DiagramState` is JSON-serializable**. Caching stores the compiled output so
  re-opening the same document costs zero compute and zero network.
- **`LucidDiagramWidget` does not modify the compiled `SceneTrack`**. It holds its own
  `liveState` field. `onTick` uses `liveState ?? compiledPlaceholderState`. This keeps
  the compiler pipeline entirely unchanged.
- **No changes to `render.ts`, `compile.ts`, or `widget.ts`** for the existing
  `diagram` element. The new `lucid-diagram` element delegates to the same rendering
  infrastructure.

---

## 3. New Package: `packages/lucid-server`

### 3.1 Purpose

A minimal Express server that:
1. Implements the OAuth 2.0 Authorization Code flow against `https://lucid.app/oauth2/authorize`
2. Stores the resulting access + refresh tokens in an in-memory server-side session
3. Proxies authenticated `GET /api/lucid/:documentId` requests to `https://api.lucid.co/documents/{id}/contents`
4. Handles token refresh transparently

This server runs on **port 3001** in development. The Vite dev server proxies `/auth`
and `/api/lucid` to it, so the browser never needs to know the server's address.

### 3.2 File Structure

```
packages/lucid-server/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore                   # ensures .env is never committed
└── src/
    ├── index.ts                 # Entry point: reads config, starts server
    ├── server.ts                # createServer(): Express app factory (testable)
    ├── config.ts                # Config type + loader from process.env
    ├── routes/
    │   ├── auth.ts              # /auth/login, /auth/callback, /auth/logout, /auth/status
    │   └── proxy.ts             # /api/lucid/:documentId
    └── middleware/
        └── requireAuth.ts       # 401 if session has no token
```

### 3.3 `package.json`

```json
{
  "name": "@brewsite/lucid-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --loader ts-node/esm src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-session": "^1.18.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  }
}
```

### 3.4 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.5 `.env.example`

```bash
# Copy to .env and fill in your Lucid OAuth app credentials.
# Register an OAuth app at https://developer.lucid.co
# NEVER commit .env to git.

LUCID_CLIENT_ID=your_client_id_here
LUCID_CLIENT_SECRET=your_client_secret_here
LUCID_REDIRECT_URI=http://localhost:5173/auth/callback
APP_URL=http://localhost:5173
PORT=3001
SESSION_SECRET=dev-session-secret-change-in-prod
```

### 3.6 `.gitignore`

```
.env
dist/
node_modules/
```

### 3.7 `src/config.ts`

```typescript
// Loads and validates server configuration from process.env.
// Throws immediately if required variables are missing so failures are obvious.

export interface ServerConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly appUrl: string;
  readonly port: number;
  readonly sessionSecret: string;
}

export function loadConfig(): ServerConfig {
  const required = ['LUCID_CLIENT_ID', 'LUCID_CLIENT_SECRET', 'LUCID_REDIRECT_URI', 'SESSION_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}. Copy .env.example to .env and fill it in.`);
    }
  }
  return {
    clientId: process.env.LUCID_CLIENT_ID!,
    clientSecret: process.env.LUCID_CLIENT_SECRET!,
    redirectUri: process.env.LUCID_REDIRECT_URI ?? 'http://localhost:5173/auth/callback',
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    port: Number(process.env.PORT ?? 3001),
    sessionSecret: process.env.SESSION_SECRET!,
  };
}
```

### 3.8 `src/index.ts`

```typescript
// Entry point: loads .env, creates server, starts listening.

import 'dotenv/config';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const app = createServer(config);

app.listen(config.port, () => {
  console.log(`[lucid-server] Listening on http://localhost:${config.port}`);
  console.log(`[lucid-server] OAuth redirect URI: ${config.redirectUri}`);
});
```

### 3.9 `src/server.ts`

```typescript
// Express app factory. Exported for testability.
// All route handlers are mounted here.

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import type { ServerConfig } from './config.js';
import { createAuthRouter } from './routes/auth.js';
import { createProxyRouter } from './routes/proxy.js';

declare module 'express-session' {
  interface SessionData {
    /** Lucid OAuth access token */
    accessToken: string;
    /** Lucid OAuth refresh token */
    refreshToken: string;
    /** Unix timestamp (ms) when the access token expires */
    tokenExpiresAt: number;
    /** Anti-CSRF state parameter */
    oauthState: string;
  }
}

export function createServer(config: ServerConfig): express.Application {
  const app = express();

  app.use(cors({
    origin: config.appUrl,
    credentials: true,
  }));

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,   // false in dev (no HTTPS); set to true in production
      maxAge: 8 * 60 * 60 * 1000,  // 8 hours: covers a full presentation day
    },
  }));

  app.use(express.json());

  app.use('/auth', createAuthRouter(config));
  app.use('/api/lucid', createProxyRouter(config));

  return app;
}
```

### 3.10 `src/routes/auth.ts`

```typescript
// OAuth 2.0 Authorization Code flow routes.
//
// Flow:
//   1. GET /auth/login     → redirect to Lucid authorization endpoint
//   2. GET /auth/callback  → exchange code for token, store in session, redirect to app
//   3. GET /auth/logout    → clear session
//   4. GET /auth/status    → { authenticated: boolean }

import { Router } from 'express';
import type { ServerConfig } from '../config.js';

const LUCID_AUTH_URL = 'https://lucid.app/oauth2/authorize';
const LUCID_TOKEN_URL = 'https://api.lucid.co/oauth2/token';
const LUCID_SCOPE = 'lucidchart.document.content:readonly';

export function createAuthRouter(config: ServerConfig): Router {
  const router = Router();

  // GET /auth/login
  // Generates a random state param (CSRF protection), stores in session,
  // then redirects the browser to Lucid's authorization page.
  router.get('/login', (req, res) => {
    const state = crypto.randomUUID();
    req.session.oauthState = state;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: LUCID_SCOPE,
      state,
    });
    res.redirect(`${LUCID_AUTH_URL}?${params.toString()}`);
  });

  // GET /auth/callback?code=...&state=...
  // Lucid redirects here after the user authorizes.
  // Exchanges the authorization code for tokens, stores them in the session,
  // then redirects the browser back to the presentation app.
  router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      console.error(`[auth] Lucid OAuth error: ${error}`);
      res.redirect(`${config.appUrl}?lucid_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state parameter');
      return;
    }

    if (state !== req.session.oauthState) {
      res.status(400).send('Invalid state parameter (CSRF check failed)');
      return;
    }

    try {
      const tokenResponse = await fetch(LUCID_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        console.error(`[auth] Token exchange failed (${tokenResponse.status}): ${body}`);
        res.redirect(`${config.appUrl}?lucid_error=token_exchange_failed`);
        return;
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;  // seconds
      };

      req.session.accessToken = tokens.access_token;
      req.session.refreshToken = tokens.refresh_token;
      req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
      delete req.session.oauthState;

      // Redirect back to the page the user was trying to reach.
      // The Vite app checks /auth/status on mount and proceeds when authenticated.
      res.redirect(config.appUrl);
    } catch (err) {
      console.error('[auth] Unexpected error during callback:', err);
      res.redirect(`${config.appUrl}?lucid_error=server_error`);
    }
  });

  // GET /auth/logout — clears the session
  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // GET /auth/status — returns authentication state, safe to call from browser on mount
  router.get('/status', (req, res) => {
    const authenticated = !!req.session.accessToken;
    res.json({ authenticated });
  });

  return router;
}
```

### 3.11 `src/middleware/requireAuth.ts`

```typescript
// Express middleware: rejects requests with 401 if no active session token.
// Applied to all /api/lucid/* routes.

import type { Request, Response, NextFunction } from 'express';
import type { ServerConfig } from '../config.js';

const LUCID_TOKEN_URL = 'https://api.lucid.co/oauth2/token';

/**
 * Ensures the session has a valid access token, refreshing it if expired.
 * Calls next() on success; writes 401 JSON on failure.
 */
export function requireAuth(config: ServerConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.accessToken) {
      res.status(401).json({ error: 'Not authenticated. Call /auth/login first.' });
      return;
    }

    // Proactively refresh if token expires within 60 seconds
    const almostExpired = req.session.tokenExpiresAt
      ? Date.now() > req.session.tokenExpiresAt - 60_000
      : false;

    if (almostExpired && req.session.refreshToken) {
      try {
        const refreshResponse = await fetch(LUCID_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: req.session.refreshToken,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
          };
          req.session.accessToken = tokens.access_token;
          if (tokens.refresh_token) req.session.refreshToken = tokens.refresh_token;
          req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
        } else {
          // Refresh failed — clear session and force re-auth
          console.warn('[requireAuth] Token refresh failed, clearing session');
          req.session.destroy(() => {});
          res.status(401).json({ error: 'Session expired. Re-authenticate.' });
          return;
        }
      } catch (err) {
        console.error('[requireAuth] Error during token refresh:', err);
        res.status(500).json({ error: 'Token refresh error' });
        return;
      }
    }

    next();
  };
}
```

### 3.12 `src/routes/proxy.ts`

```typescript
// Proxies authenticated document-content requests to the Lucid REST API.
//
// GET /api/lucid/:documentId?page=0
//   → GET https://api.lucid.co/documents/:documentId/contents
//   → forwards Lucid's JSON response verbatim
//   → forwards the ETag header so the browser cache layer can detect changes
//
// The ?page query param is used by the browser to select the right page from
// the Lucid response. It is NOT forwarded to Lucid (Lucid returns all pages;
// the browser selects the page from the response).

import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';

const LUCID_API_BASE = 'https://api.lucid.co';

export function createProxyRouter(config: ServerConfig): Router {
  const router = Router();

  router.use(requireAuth(config));

  // GET /api/lucid/:documentId
  router.get('/:documentId', async (req, res) => {
    const { documentId } = req.params;
    const url = `${LUCID_API_BASE}/documents/${encodeURIComponent(documentId)}/contents`;

    try {
      const lucidResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${req.session.accessToken}`,
          'Lucid-Api-Version': '1',
        },
      });

      if (!lucidResponse.ok) {
        const body = await lucidResponse.text();
        console.error(`[proxy] Lucid API error for document ${documentId} (${lucidResponse.status}): ${body}`);
        res.status(lucidResponse.status).json({ error: `Lucid API error: ${lucidResponse.status}` });
        return;
      }

      // Forward ETag for browser-side cache invalidation
      const etag = lucidResponse.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);
      res.setHeader('Content-Type', 'application/json');

      const data = await lucidResponse.json();
      res.json(data);
    } catch (err) {
      console.error(`[proxy] Fetch error for document ${documentId}:`, err);
      res.status(500).json({ error: 'Proxy fetch error' });
    }
  });

  return router;
}
```

---

## 4. New Module: `packages/diagram/src/lucid/`

This module is part of `@brewsite/diagram`. It is browser-compatible: no Node.js APIs,
no ZIP parsing, no HJSON. It depends only on the diagram types already in the package.

### 4.1 File Structure

```
packages/diagram/src/lucid/
├── types.ts          # Raw Lucid API JSON types (loose — Lucid's format is internal)
├── converter.ts      # convertLucidPage(): LucidDocumentJSON → DiagramDSL (pure)
├── client.ts         # fetchLucidDocument(): calls /api/lucid/:id via fetch
├── cache.ts          # LucidDiagramCache: localStorage-backed DiagramState cache
└── index.ts          # Re-exports
```

### 4.2 `lucid/types.ts`

```typescript
// Raw Lucid API document JSON types.
// These types reflect Lucid's internal document format (same structure as
// document.json inside a .lucid ZIP export). They are intentionally loose
// because Lucid does not publish a formal schema for this format.
// All fields are optional or unknown unless we have confirmed their shape.

/** Top-level document response from GET /api/lucid/:documentId */
export interface LucidDocumentJSON {
  readonly pages?: ReadonlyArray<LucidPageJSON>;
  readonly document?: { readonly pages?: ReadonlyArray<LucidPageJSON> };
  // Some document versions put pages at the top level
  [key: string]: unknown;
}

/** A single page within a Lucid document */
export interface LucidPageJSON {
  readonly id?: string;
  readonly title?: string;
  // Items appear in various nested structures; collectItems() flattens them
  readonly items?: ReadonlyArray<LucidItemJSON>;
  readonly children?: ReadonlyArray<LucidItemJSON>;
  [key: string]: unknown;
}

/** A single item (shape, line, or group) within a page */
export interface LucidItemJSON {
  readonly id?: string;
  readonly type?: string;
  readonly shapeType?: string;
  readonly name?: string;
  // Bounding box — Lucid uses different field names across versions
  readonly boundingBox?: LucidBoundingBox;
  readonly bounds?: LucidBoundingBox;
  readonly bbox?: LucidBoundingBox;
  readonly geometry?: { readonly boundingBox?: LucidBoundingBox };
  // Label text — highly variable structure
  readonly text?: unknown;
  readonly label?: unknown;
  readonly labels?: ReadonlyArray<unknown>;
  // Style
  readonly style?: { readonly fill?: string; readonly fillColor?: string };
  // Grouping
  readonly parentId?: string;
  readonly groupId?: string;
  // Edge endpoints
  readonly endpoint1?: { readonly shapeId?: string };
  readonly endpoint2?: { readonly shapeId?: string };
  readonly start?: { readonly shapeId?: string; readonly shape?: string };
  readonly end?: { readonly shapeId?: string; readonly shape?: string };
  // Nested children
  readonly items?: ReadonlyArray<LucidItemJSON>;
  readonly children?: ReadonlyArray<LucidItemJSON>;
  [key: string]: unknown;
}

/** Bounding box as found in various Lucid JSON fields */
export interface LucidBoundingBox {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Options for convertLucidPage() */
export interface LucidConvertOptions {
  /**
   * Uniform scale applied to the compiled DiagramState.
   * Since Lucid uses pixel coordinates, use scale = desired_world_units / lucid_pixel_width.
   * Example: for a 1000px-wide Lucid diagram that should be 10 world units wide: scale = 0.01
   * Default: 0.01
   */
  readonly scale?: number;
  /**
   * Pivot point for the compiled diagram.
   * 'top-left' is recommended for Lucid imports (Lucid's Y increases downward,
   * and coordinates start at the top-left of the page).
   * Default: 'top-left'
   */
  readonly pivot?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}
```

### 4.3 `lucid/converter.ts`

```typescript
// Pure converter: Lucid document page JSON → DiagramDSL.
// Browser-compatible port of scripts/import-lucid.mjs.
// No Node.js APIs. No ZIP. No HJSON. No side effects.

import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL } from '../elements/diagram/types';
import type {
  LucidDocumentJSON,
  LucidPageJSON,
  LucidItemJSON,
  LucidBoundingBox,
  LucidConvertOptions,
} from './types';

// Mirrors LUCID_SHAPE_MAP from import-lucid.mjs — kept in sync manually.
// If new shape mappings are added to the script, add them here too.
const LUCID_SHAPE_MAP: Record<string, string> = {
  rectangleShape:         'flow:rect',
  roundedRectangleShape:  'flow:rounded',
  processShape:           'flow:rounded',
  decisionShape:          'flow:diamond',
  databaseShape:          'flow:cylinder',
  ovalShape:              'flow:oval',
  cloudShape:             'flow:cloud',
  actorShape:             'flow:actor',
  documentShape:          'flow:document',
  parallelogramShape:     'flow:parallelogram',
  'aws3.EC2':                   'aws:ec2',
  'aws3.S3':                    'aws:s3',
  'aws3.RDSInstance':           'aws:rds',
  'aws3.Lambda':                'aws:lambda',
  'aws3.ApplicationLoadBalancing': 'aws:alb',
  'aws3.CloudFront':            'aws:cloudfront',
  'aws3.VPC':                   'aws:vpc',
  'aws3.ECSContainer':          'aws:ecs',
  'aws3.SQSQueue':              'aws:sqs',
  'aws3.SNSTopic':              'aws:sns',
};

/** Pixels per diagram unit. Matches import-lucid.mjs PIXEL_TO_UNIT constant. */
const PIXEL_TO_UNIT = 100;

/** Recursively collects all items from a Lucid page tree into a flat array. */
function collectItems(node: unknown, out: LucidItemJSON[] = []): LucidItemJSON[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectItems(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  out.push(obj as LucidItemJSON);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') collectItems(val, out);
  }
  return out;
}

/** Extracts a plain string from the many label formats Lucid uses. */
function extractText(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return extractText(obj[0]);
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o['text'] === 'string') return o['text'];
    if (Array.isArray(o['text'])) return extractText(o['text'][0]);
    if (typeof o['value'] === 'string') return o['value'];
    if (typeof o['label'] === 'string') return o['label'];
    if (Array.isArray(o['labels'])) return extractText(o['labels'][0]);
  }
  return '';
}

/** Resolves a bounding box from the field names Lucid uses across versions. */
function getBoundingBox(item: LucidItemJSON): LucidBoundingBox | null {
  return item.boundingBox
    ?? item.bounds
    ?? item.bbox
    ?? item.geometry?.boundingBox
    ?? null;
}

function isLine(item: LucidItemJSON): boolean {
  return typeof item.type === 'string' && item.type.toLowerCase().includes('line');
}

function isGroup(item: LucidItemJSON): boolean {
  return typeof item.type === 'string' && item.type.toLowerCase().includes('group');
}

function isShape(item: LucidItemJSON): boolean {
  return getBoundingBox(item) !== null
    && typeof item.id === 'string'
    && !isLine(item)
    && !isGroup(item);
}

/**
 * Selects a page from a Lucid document JSON response.
 * Returns null if the document has no pages or the index is out of range.
 */
export function selectLucidPage(doc: LucidDocumentJSON, pageIndex: number): LucidPageJSON | null {
  const pages = doc.pages ?? doc.document?.pages ?? [];
  if (!Array.isArray(pages) || pages.length === 0) return null;
  if (pageIndex < 0 || pageIndex >= pages.length) return null;
  return pages[pageIndex] as LucidPageJSON;
}

/**
 * Converts a single Lucid document page to a DiagramDSL.
 * Pure function — no side effects, no async, no I/O.
 *
 * Coordinate convention:
 *   Lucid x, y are in pixels from the top-left of the page.
 *   We convert to diagram units by dividing by PIXEL_TO_UNIT (100).
 *   Y is negated because BrewSite's Y axis points up, Lucid's points down.
 *   Node position is the center of the bounding box.
 *
 * Shape mapping:
 *   Known Lucid shape types are mapped via LUCID_SHAPE_MAP.
 *   Unknown types fall back to 'flow:rect' with a console.warn.
 *
 * @param page - A single page from the Lucid document JSON
 * @param diagramId - The ID to assign to the compiled Diagram element
 * @param opts - Conversion options (scale, pivot)
 */
export function convertLucidPage(
  page: LucidPageJSON,
  diagramId: string,
  opts: LucidConvertOptions = {},
): DiagramDSL {
  const scale = opts.scale ?? 0.01;
  const pivot = opts.pivot ?? 'top-left';

  const allItems = collectItems(page);
  const shapes = allItems.filter(isShape);
  const lines = allItems.filter(isLine);
  const groups = allItems.filter(isGroup);

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const nodes: DiagramNodeDSL[] = shapes.map((shape): DiagramNodeDSL => {
    const box = getBoundingBox(shape)!;
    const pixelX = (box.x ?? 0);
    const pixelY = (box.y ?? 0);
    const pixelW = box.w ?? box.width ?? 80;
    const pixelH = box.h ?? box.height ?? 60;

    const centerX = pixelX + pixelW / 2;
    const centerY = pixelY + pixelH / 2;

    const id = String(shape.id ?? `node-${Math.random().toString(36).slice(2, 8)}`);
    const rawType = shape.type ?? shape.shapeType ?? shape.name ?? 'rectangleShape';
    const mappedShape = LUCID_SHAPE_MAP[rawType];
    if (!mappedShape) {
      console.warn(`[lucid/converter] Unknown shape type "${rawType}" (id: ${id}), falling back to flow:rect`);
    }

    const label = extractText(shape.text ?? shape.label ?? shape) || id;
    const color = shape.style?.fill ?? shape.style?.fillColor ?? undefined;

    return {
      id,
      label,
      shape: (mappedShape ?? 'flow:rect') as DiagramNodeDSL['shape'],
      // Positions are in Lucid pixel space; DiagramDSL positions are pre-scale.
      // The <Diagram scale={scale}> prop applies the pixel→world unit conversion.
      position: [centerX / PIXEL_TO_UNIT, -centerY / PIXEL_TO_UNIT, 0],
      size: [pixelW / PIXEL_TO_UNIT, pixelH / PIXEL_TO_UNIT],
      ...(color !== undefined ? { color } : {}),
      ...(shape.parentId ?? shape.groupId
        ? { groupId: String(shape.parentId ?? shape.groupId) }
        : {}),
    };
  });

  // ── Edges ──────────────────────────────────────────────────────────────────
  const edges: DiagramEdgeDSL[] = lines
    .map((line): DiagramEdgeDSL | null => {
      const from = line.endpoint1?.shapeId
        ?? (line.start as Record<string, unknown>)?.['shapeId'] as string | undefined
        ?? (line.start as Record<string, unknown>)?.['shape'] as string | undefined
        ?? null;
      const to = line.endpoint2?.shapeId
        ?? (line.end as Record<string, unknown>)?.['shapeId'] as string | undefined
        ?? (line.end as Record<string, unknown>)?.['shape'] as string | undefined
        ?? null;
      if (!from || !to) return null;
      return { from: String(from), to: String(to) };
    })
    .filter((e): e is DiagramEdgeDSL => e !== null);

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groupNodeMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.groupId) continue;
    const existing = groupNodeMap.get(node.groupId) ?? [];
    existing.push(node.id);
    groupNodeMap.set(node.groupId, existing);
  }

  const compiledGroups: DiagramGroupDSL[] = groups
    .map((group): DiagramGroupDSL => {
      const id = String(group.id ?? `group-${Math.random().toString(36).slice(2, 8)}`);
      const label = extractText(group.text ?? group.label ?? group) || id;
      return {
        id,
        label,
        nodeIds: groupNodeMap.get(id) ?? [],
      };
    })
    .filter((g) => g.nodeIds.length > 0);

  return {
    id: diagramId,
    layout: 'manual',
    layoutSpacing: [2, 2],
    nodes,
    edges,
    groups: compiledGroups,
    scale,
    pivot,
  };
}
```

### 4.4 `lucid/cache.ts`

```typescript
// Browser-side DiagramState cache backed by localStorage.
// Serializes/deserializes compiled DiagramState objects keyed by
// document ID, page index, and ETag.
//
// Storage budget: DiagramState for a typical 50-node diagram is ~80–150KB as JSON.
// localStorage limit is ~5MB. The cache logs a warning if total usage exceeds 4MB.

import type { DiagramState } from '../elements/diagram/types';

const CACHE_KEY_PREFIX = 'lucid_cache:';
const MAX_STORAGE_BYTES = 4 * 1024 * 1024; // 4MB warning threshold

export interface CachedDiagramEntry {
  readonly etag: string;
  readonly state: DiagramState;
  readonly cachedAt: number;  // Unix timestamp (ms)
}

/**
 * Returns a deterministic cache key for a given document/page/etag combo.
 * The etag ensures stale cache entries are never used after the document changes.
 */
export function buildCacheKey(documentId: string, pageIndex: number, etag: string): string {
  return `${CACHE_KEY_PREFIX}${documentId}:${pageIndex}:${etag}`;
}

/**
 * Reads a cached DiagramState from localStorage.
 * Returns null if the key is not found or if the stored value is corrupted.
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
    const entry = JSON.parse(raw) as CachedDiagramEntry;
    return entry.state;
  } catch {
    // Corrupted entry — evict it
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Writes a compiled DiagramState to localStorage.
 * Silently no-ops if localStorage is unavailable (SSR, private browsing quota).
 * Logs a warning if total cache usage exceeds MAX_STORAGE_BYTES.
 */
export function writeCachedDiagramState(
  documentId: string,
  pageIndex: number,
  etag: string,
  state: DiagramState,
): void {
  const key = buildCacheKey(documentId, pageIndex, etag);
  const entry: CachedDiagramEntry = { etag, state, cachedAt: Date.now() };
  try {
    const serialized = JSON.stringify(entry);
    localStorage.setItem(key, serialized);
    checkStorageBudget();
  } catch (err) {
    console.warn('[lucid/cache] Could not write to localStorage:', err);
  }
}

/**
 * Removes all cache entries with a given documentId and pageIndex, regardless of etag.
 * Call this to proactively evict stale entries for a document.
 */
export function evictCachedDocument(documentId: string, pageIndex: number): void {
  const prefix = `${CACHE_KEY_PREFIX}${documentId}:${pageIndex}:`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}

function checkStorageBudget(): void {
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      totalBytes += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16 approx
    }
  }
  if (totalBytes > MAX_STORAGE_BYTES) {
    console.warn(
      `[lucid/cache] Cache storage exceeds ${MAX_STORAGE_BYTES / 1024 / 1024}MB. ` +
      'Consider evicting old entries.',
    );
  }
}
```

### 4.5 `lucid/client.ts`

```typescript
// Browser-side client for the Lucid document proxy.
// Calls /api/lucid/:documentId, which is proxied to the lucid-server in dev.
// Returns the raw Lucid document JSON and the ETag for cache keying.

import type { LucidDocumentJSON, LucidPageJSON } from './types';
import { selectLucidPage } from './converter';

export class LucidAuthError extends Error {
  constructor() { super('Not authenticated with Lucid. Redirect to /auth/login.'); }
}

export class LucidFetchError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

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
    credentials: 'include',  // sends the session cookie
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
```

### 4.6 `lucid/index.ts`

```typescript
// Public re-exports for the lucid/ module.
export type {
  LucidDocumentJSON, LucidPageJSON, LucidItemJSON,
  LucidBoundingBox, LucidConvertOptions,
} from './types';
export { convertLucidPage, selectLucidPage } from './converter';
export {
  readCachedDiagramState, writeCachedDiagramState,
  evictCachedDocument, buildCacheKey,
} from './cache';
export { fetchLucidPage, checkLucidAuthStatus, LucidAuthError, LucidFetchError } from './client';
```

---

## 5. New Element Module: `packages/diagram/src/elements/lucid-diagram/`

Follows the mandatory element module pattern: `types.ts → dsl.tsx → compile.ts → widget.ts → index.ts`.
There is no `render.ts` here — rendering is fully delegated to the existing
`DiagramWidget`/`DiagramRenderer` infrastructure.

### 5.1 File Structure

```
packages/diagram/src/elements/lucid-diagram/
├── types.ts    # LucidDiagramDSL, LucidDiagramLoadState
├── dsl.tsx     # <LucidDiagram> React component
├── compile.ts  # compileLucidDiagram(): produces placeholder DiagramState
├── widget.ts   # LucidDiagramWidget: manages async lifecycle + state injection
└── index.ts    # Re-exports
```

### 5.2 `lucid-diagram/types.ts`

```typescript
// Contract layer for the LucidDiagram element.
// No runtime imports. No Three.js. No React.

import type { DiagramTheme } from '../diagram/types';
import type { LucidConvertOptions } from '../../lucid/types';

/**
 * DSL props for the <LucidDiagram> element.
 * Provided directly by the author — no children are allowed.
 */
export interface LucidDiagramDSL {
  /** Unique element ID within the scene. Must match the widget ID in any transitions. */
  readonly id: string;
  /** The Lucid document ID, found in the document URL: lucid.app/documents/{documentId}/ */
  readonly documentId: string;
  /** Zero-based page index within the Lucid document. Default: 0 */
  readonly pageIndex?: number;
  /** Visual theme applied to the compiled diagram. Default: darkGlassTheme */
  readonly theme?: DiagramTheme;
  /** Position in world/parent space. Default: [0, 0, 0] */
  readonly position?: readonly [number, number, number];
  /** Euler XYZ rotation in radians. Default: [0, 0, 0] */
  readonly rotation?: readonly [number, number, number];
  /** Uniform scale. Used for pixel → world unit conversion. Default: 0.01 */
  readonly scale?: number;
  /**
   * Pivot point for the loaded diagram. Default: 'top-left'
   * 'top-left' is recommended for Lucid imports — Lucid's coordinate origin
   * is the top-left of the page, so this produces no offset shift.
   */
  readonly pivot?: LucidConvertOptions['pivot'];
}

/**
 * The load lifecycle state of a LucidDiagramWidget.
 * This is internal to widget.ts — it is not part of the compiled SceneTrack.
 */
export type LucidDiagramLoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded' }
  | { readonly status: 'error'; readonly message: string };
```

### 5.3 `lucid-diagram/dsl.tsx`

```typescript
// Authoring surface for dynamic Lucid diagram elements.
// No Three.js. No runtime logic.
// This component is never rendered — it is consumed as a React element tree
// by the BrewSite compiler via the registered LucidDiagram handler.

import type { LucidDiagramDSL } from './types';

export function LucidDiagram(_props: LucidDiagramDSL): null {
  return null;
}
```

### 5.4 `lucid-diagram/compile.ts`

```typescript
// Compile-time step for LucidDiagram.
// Produces a placeholder DiagramState with a single "Loading..." node.
// This placeholder is baked into the SceneTrack so the scene compiles normally.
// The live DiagramState is injected later by LucidDiagramWidget.
//
// No Three.js. No React. No async. No network calls.

import type { DiagramState, DiagramTheme } from '../diagram/types';
import type { LucidDiagramDSL } from './types';
import { compileDiagram } from '../diagram/compile';
import { darkGlassTheme } from '../diagram/themes/darkGlass';

/**
 * Produces a minimal placeholder DiagramState for a LucidDiagram element.
 * The placeholder renders as a single "Connecting to Lucid..." node so the
 * author can see the element is present before the live data arrives.
 */
export function compileLucidDiagramPlaceholder(
  dsl: LucidDiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
): DiagramState {
  return compileDiagram(
    {
      id: dsl.id,
      layout: 'manual',
      layoutSpacing: [2, 2],
      position: dsl.position,
      rotation: dsl.rotation,
      scale: dsl.scale ?? 0.01,
      pivot: dsl.pivot ?? 'top-left',
      nodes: [
        {
          id: '__loading__',
          label: 'Connecting to Lucid...',
          shape: 'flow:rect',
          position: [0, 0, 0],
          size: [6, 1.2],
          opacity: 0.4,
        },
      ],
      edges: [],
      groups: [],
      theme: dsl.theme,
    },
    fallbackTheme,
  );
}
```

### 5.5 `lucid-diagram/widget.ts`

```typescript
// LucidDiagramWidget: implements ISceneElement for the LucidDiagram element.
//
// Lifecycle:
//   1. Created with a pre-compiled placeholder DiagramState (from compile.ts).
//   2. On first onTick(), initiates the async load pipeline:
//      fetchLucidPage → convertLucidPage → compileDiagram → liveState
//   3. Subsequent onTick() calls render liveState if available,
//      placeholder state otherwise.
//
// State injection model:
//   The widget holds its own `liveState` field outside the SceneTrack.
//   onTick() is called with the track's compiled placeholder state; the widget
//   ignores that and uses liveState when it is ready. This keeps the compiler
//   pipeline unchanged.
//
// Error handling:
//   Fetch errors are logged via console.warn. The widget continues to render
//   the placeholder state; no throw or silent failure.

import type { ISceneElement, ISceneElementContext } from '@brewsite/core';
import type { DiagramState, DiagramTheme } from '../diagram/types';
import type { LucidDiagramDSL, LucidDiagramLoadState } from './types';
import { compileDiagram } from '../diagram/compile';
import { DiagramRenderer } from '../diagram/render';
import { darkGlassTheme } from '../diagram/themes/darkGlass';
import { convertLucidPage } from '../../lucid/converter';
import { fetchLucidPage, LucidAuthError, LucidFetchError } from '../../lucid/client';
import {
  readCachedDiagramState,
  writeCachedDiagramState,
  evictCachedDocument,
} from '../../lucid/cache';

export class LucidDiagramWidget implements ISceneElement {
  private readonly renderer: DiagramRenderer;
  private readonly dsl: LucidDiagramDSL;
  private readonly theme: DiagramTheme;
  private liveState: DiagramState | null = null;
  private loadState: LucidDiagramLoadState = { status: 'idle' };
  private abortController: AbortController | null = null;

  constructor(dsl: LucidDiagramDSL, fallbackTheme: DiagramTheme = darkGlassTheme) {
    this.dsl = dsl;
    this.theme = dsl.theme ?? fallbackTheme;
    this.renderer = new DiagramRenderer();
  }

  onTick(placeholderState: DiagramState, context: ISceneElementContext): void {
    // Kick off the load on the first tick after scene start
    if (this.loadState.status === 'idle') {
      this.loadState = { status: 'loading' };
      void this.loadAsync();
    }

    // Render live state if available; fall back to placeholder
    this.renderer.render(this.liveState ?? placeholderState, context);
  }

  onDispose(): void {
    this.abortController?.abort();
    this.renderer.dispose();
  }

  private async loadAsync(): Promise<void> {
    const { documentId, pageIndex = 0 } = this.dsl;
    this.abortController = new AbortController();

    try {
      // Step 1: fetch from proxy (gets ETag for cache key)
      const { page, etag } = await fetchLucidPage(
        documentId,
        pageIndex,
        this.abortController.signal,
      );

      // Step 2: check compiled-state cache
      if (etag) {
        const cached = readCachedDiagramState(documentId, pageIndex, etag);
        if (cached) {
          this.liveState = cached;
          this.loadState = { status: 'loaded' };
          return;
        }
      }

      // Step 3: convert Lucid JSON → DiagramDSL
      const dsl = convertLucidPage(page, this.dsl.id, {
        scale: this.dsl.scale ?? 0.01,
        pivot: this.dsl.pivot ?? 'top-left',
      });

      // Step 4: compile DiagramDSL → DiagramState
      const state = compileDiagram(
        { ...dsl, position: this.dsl.position, rotation: this.dsl.rotation, theme: this.dsl.theme },
        this.theme,
      );

      // Step 5: cache the compiled result
      if (etag) {
        evictCachedDocument(documentId, pageIndex); // evict any stale etag entries
        writeCachedDiagramState(documentId, pageIndex, etag, state);
      }

      this.liveState = state;
      this.loadState = { status: 'loaded' };
    } catch (err) {
      if (err instanceof LucidAuthError) {
        console.warn(`[LucidDiagramWidget] Not authenticated with Lucid (id: ${this.dsl.id}). ` +
          'Wrap the page in <LucidAuthGate> to prompt login before loading the presentation.');
        this.loadState = { status: 'error', message: 'Not authenticated' };
      } else if (err instanceof LucidFetchError) {
        console.warn(`[LucidDiagramWidget] Fetch error for document "${documentId}" (${err.status}): ${err.message}`);
        this.loadState = { status: 'error', message: err.message };
      } else if ((err as Error)?.name === 'AbortError') {
        // Widget was disposed before load completed — expected, not an error
      } else {
        console.error(`[LucidDiagramWidget] Unexpected error loading document "${documentId}":`, err);
        this.loadState = { status: 'error', message: 'Unexpected error' };
      }
    }
  }
}
```

### 5.6 `lucid-diagram/index.ts`

```typescript
export { LucidDiagram } from './dsl';
export type { LucidDiagramDSL, LucidDiagramLoadState } from './types';
export { compileLucidDiagramPlaceholder } from './compile';
export { LucidDiagramWidget } from './widget';
```

---

## 6. Compiler Handler Registration

Add a `LucidDiagram` handler to `packages/diagram/src/compiler/handlers.ts`.

Append after the existing `DiagramCanvas` handler:

```typescript
// In handlers.ts — import additions:
import { LucidDiagram } from '../elements/lucid-diagram/dsl';
import type { LucidDiagramDSL } from '../elements/lucid-diagram/types';
import { compileLucidDiagramPlaceholder } from '../elements/lucid-diagram/compile';
import { LucidDiagramWidget } from '../elements/lucid-diagram/widget';

// Handler registration addition (inside registerDiagramHandlers()):
registerNode(LucidDiagram, (node, api) => {
  const props = node.props as LucidDiagramDSL;
  const placeholder = compileLucidDiagramPlaceholder(props);
  // Register with the engine: same widget ID as the diagram id.
  // The widget holds its own liveState which overrides the placeholder at render time.
  api.registerWidget(props.id, new LucidDiagramWidget(props), placeholder);
});
```

Note: The exact `api.registerWidget` call signature depends on the current `CompileApi`
contract. If the API uses `setWidgetState` rather than `registerWidget`, adapt
accordingly. The intent is: register the placeholder compiled state against the element
ID, and provide the widget instance that will manage its own live state.

---

## 7. `packages/diagram/src/index.ts` — Add Exports

```typescript
// Add to the existing public exports:
export { LucidDiagram } from './elements/lucid-diagram/dsl';
export type { LucidDiagramDSL } from './elements/lucid-diagram/types';
```

---

## 8. Vite Dev Server Proxy

**File:** `apps/examples/vite.config.ts`

Add a `proxy` block to the `server` config so the browser's `/auth` and `/api/lucid`
requests are forwarded to the Express server:

```typescript
server: {
  host: true,
  port: 5173,
  allowedHosts: ['localhost', '127.0.0.1'],
  proxy: {
    '/auth': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      // Preserve the session cookie path
    },
    '/api/lucid': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
},
```

The browser always calls `localhost:5173/auth/...` and `localhost:5173/api/lucid/...`.
Vite forwards these transparently. No CORS headers needed. Session cookies work
because both the browser and proxy share the same origin from the browser's
perspective.

---

## 9. Auth Gate Component

**New file:** `apps/examples/vite-app/components/LucidAuthGate.tsx`

```typescript
// Renders its children only when the browser session is authenticated with Lucid.
// If not authenticated, renders a full-screen login prompt.
// Designed to wrap any page that uses <LucidDiagram> elements.

import { useEffect, useState } from 'react';
import { checkLucidAuthStatus } from '@brewsite/diagram';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

interface LucidAuthGateProps {
  readonly children: React.ReactNode;
}

export function LucidAuthGate({ children }: LucidAuthGateProps): React.ReactElement {
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    checkLucidAuthStatus().then((authenticated) => {
      setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  if (authState === 'checking') {
    return (
      <div style={gateStyles.container}>
        <p style={gateStyles.label}>Checking Lucid authentication…</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div style={gateStyles.container}>
        <h2 style={gateStyles.heading}>Connect your Lucid account</h2>
        <p style={gateStyles.label}>
          Sign in with Lucid to load your diagrams into the presentation.
        </p>
        <button
          style={gateStyles.button}
          onClick={() => { window.location.href = '/auth/login'; }}
        >
          Sign in with Lucid
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

const gateStyles = {
  container: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', height: '100vh', gap: '16px',
    background: '#0a0f1e', color: '#e8eeff',
  },
  heading: { fontSize: '24px', margin: 0 },
  label: { fontSize: '14px', color: '#8ba4d4', margin: 0 },
  button: {
    padding: '12px 32px', fontSize: '16px', borderRadius: '6px',
    background: '#2a4fa0', color: '#fff', border: 'none', cursor: 'pointer',
  },
};
```

---

## 10. New Route in Examples App

**File:** `apps/examples/vite-app/App.tsx`

Add a new route:

```tsx
import { LucidAuthGate } from './components/LucidAuthGate';
import { LucidDiagramPage } from './pages/LucidDiagramPage';

// Inside <Routes>:
<Route
  path="/lucid-diagram"
  element={
    <LucidAuthGate>
      <LucidDiagramPage />
    </LucidAuthGate>
  }
/>
```

**New file:** `apps/examples/vite-app/pages/LucidDiagramPage.tsx`

```tsx
// Demo page: renders a scene with a <LucidDiagram> loaded dynamically.
// Replace DOCUMENT_ID with the ID of a real Lucid document to test end-to-end.

import { DiagramCanvas, LucidDiagram, darkGlassTheme } from '@brewsite/diagram';
// ... (standard scene engine setup matching other pages in apps/examples)

const DOCUMENT_ID = 'YOUR_LUCID_DOCUMENT_ID_HERE';

export function LucidDiagramPage(): React.ReactElement {
  return (
    // Standard BrewSite scene engine boilerplate here —
    // match the pattern used in DiagramPage.tsx or DiagramAutoPage.tsx
    <DiagramCanvas id="demo-canvas" theme={darkGlassTheme}>
      <LucidDiagram
        id="live-diagram"
        documentId={DOCUMENT_ID}
        pageIndex={0}
        theme={darkGlassTheme}
        scale={0.01}
        pivot="top-left"
      />
    </DiagramCanvas>
  );
}
```

---

## 11. Turbo Pipeline Changes

**File:** `turbo.json`

Add a `dev:server` task for the Express server (non-persistent dev tasks use `cache:
false`, but server is `persistent: true`):

```json
"dev:server": {
  "cache": false,
  "persistent": true
}
```

**Root `package.json` scripts addition:**

```json
"dev:server": "turbo dev:server --filter=@brewsite/lucid-server"
```

---

## 12. Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create the server's .env file
cp packages/lucid-server/.env.example packages/lucid-server/.env
# Edit .env: fill in LUCID_CLIENT_ID, LUCID_CLIENT_SECRET

# 3. Register an OAuth app with Lucid at:
#    https://developer.lucid.co
#    Redirect URI: http://localhost:5173/auth/callback
#    Scope: lucidchart.document.content:readonly
```

### Running in Development

Two terminal windows:

```bash
# Terminal 1: Express OAuth server
pnpm dev:server

# Terminal 2: Vite dev server (examples app)
pnpm dev
```

### Testing the Auth Flow

1. Navigate to `http://localhost:5173/lucid-diagram`
2. `LucidAuthGate` detects unauthenticated state → shows login prompt
3. Click "Sign in with Lucid" → browser redirects to `https://lucid.app/oauth2/authorize`
4. Authenticate with your Lucid credentials
5. Lucid redirects back to `http://localhost:5173/auth/callback`
6. Vite proxy forwards to `http://localhost:3001/auth/callback`
7. Server exchanges code for token, stores in session
8. Server redirects browser to `http://localhost:5173`
9. Navigate to `/lucid-diagram` again → authenticated → page renders
10. `LucidDiagramWidget` loads, converts, compiles the document → diagram appears

### Single Terminal Option (Turbo)

Add to root `package.json`:
```json
"dev:full": "turbo dev --filter=@brewsite/examples && turbo dev:server --filter=@brewsite/lucid-server"
```

Or use `concurrently` / a Turbo parallel task definition.

---

## 13. Data Flow (End-to-End)

```
Browser: /lucid-diagram
  │
  ├── LucidAuthGate: GET /auth/status → {authenticated: true}
  │     ↓ (if false → show login UI → /auth/login → Lucid OAuth → /auth/callback)
  │
  ├── Scene compiles with placeholder DiagramState (LucidDiagramWidget created)
  │
  └── LucidDiagramWidget.onTick() (first tick after scene start)
        │
        ├── GET /api/lucid/{documentId}     (Vite proxy → Express server)
        │     │
        │     ├── requireAuth middleware: reads accessToken from session
        │     └── GET https://api.lucid.co/documents/{id}/contents
        │           Authorization: Bearer {accessToken}
        │           ← { pages: [...], ETag: "abc123" }
        │     ← raw LucidDocumentJSON + ETag
        │
        ├── readCachedDiagramState(docId, pageIndex, etag)
        │     hit → liveState = cached DiagramState, done
        │     miss ↓
        │
        ├── convertLucidPage(page, diagramId, { scale, pivot })
        │     → DiagramDSL { nodes[], edges[], groups[], layout: 'manual' }
        │
        ├── compileDiagram(dsl, theme)
        │     → DiagramState { nodes[], edges[], bounds, themeConfig, ... }
        │
        ├── writeCachedDiagramState(docId, pageIndex, etag, state)
        │     → localStorage["lucid_cache:{docId}:{pageIndex}:{etag}"]
        │
        └── this.liveState = state
              ↓ next onTick() renders live diagram
```

---

## 14. Error Handling Matrix

| Error Condition | Response |
|---|---|
| `lucid-server` not running | Vite proxy returns 502; `LucidFetchError(502)` logged via `console.warn`; placeholder shown |
| Not authenticated (401) | `LucidAuthError` logged; placeholder shown; `LucidAuthGate` should prevent this case |
| Document not found (404) | `LucidFetchError(404)` logged; placeholder shown |
| Unknown Lucid shape type | `console.warn` in `converter.ts`; shape falls back to `flow:rect` |
| localStorage full | `console.warn` in `cache.ts`; fetch/compile still succeeds; cache write silently skipped |
| Corrupted cache entry | Cache entry evicted on read; full fetch/compile fallback |
| AbortError (widget disposed) | Silently ignored |
| Token expired mid-session | `requireAuth` middleware refreshes transparently; presenter unaffected |
| Refresh token expired | Session cleared; 401 returned; `LucidAuthGate` re-prompts for login |

---

## 15. Testing Strategy

### `packages/lucid-server`

The Express server is tested via `supertest` against `createServer()` (the exported
factory, not the live listening instance).

Key test cases:
- `GET /auth/login` redirects to Lucid auth URL with correct params
- `GET /auth/callback` with mismatched state returns 400
- `GET /auth/callback` with valid code stores token in session
- `GET /auth/status` returns `{authenticated: false}` without session
- `GET /auth/status` returns `{authenticated: true}` with session
- `GET /api/lucid/:id` returns 401 without session
- `GET /api/lucid/:id` with session calls Lucid API (use `nock` or `msw` to intercept)

Note: `supertest` is added as a devDependency only for the server package.

### `packages/diagram/src/lucid/converter.ts`

Pure function — straightforward unit tests with interface-based stateful inputs.
No mocks needed. Input: raw Lucid JSON page objects. Output: assert `DiagramDSL` structure.

Test file: `packages/diagram/src/lucid/__tests__/converter.test.ts`

Key test cases:
- Shapes with known types map to correct `DiagramShapeVariant`
- Unknown shape type falls back to `flow:rect`
- Pixel coordinates are divided by `PIXEL_TO_UNIT` and Y is negated
- Lines with missing `shapeId` are excluded from edges
- Groups with zero member nodes are excluded
- Empty page returns valid DiagramDSL with empty arrays
- `selectLucidPage` returns null for out-of-range index

### `packages/diagram/src/lucid/cache.ts`

Tests use the `jsdom` environment to simulate `localStorage`.

Test file: `packages/diagram/src/lucid/__tests__/cache.test.ts`

Key test cases:
- Write → read round-trip preserves DiagramState
- Cache miss returns null
- Corrupted entry returns null and is evicted
- `evictCachedDocument` removes all entries for a docId/pageIndex pair

### `packages/diagram/src/elements/lucid-diagram/compile.ts`

Pure function — tests assert the placeholder DiagramState structure.

Test file: `packages/diagram/src/elements/lucid-diagram/__tests__/compile.test.ts`

Key test cases:
- Placeholder has exactly one node with label "Connecting to Lucid..."
- Position, rotation, scale, pivot from DSL are reflected in compiled state
- Missing optional fields use documented defaults

---

## 16. Security Notes (Dev Environment)

- **`.env` is git-excluded** via `packages/lucid-server/.gitignore`. The
  `.env.example` commits the key names with no values.
- **`client_secret` never reaches the browser** — it is read by the server only and
  used only in the server-side token exchange and refresh calls.
- **Session cookie is `httpOnly: true`** — JavaScript cannot read it.
- **State parameter (CSRF)** — generated per login attempt, verified in callback.
- **Token is never logged** — no `console.log(accessToken)` anywhere.
- **Scopes are minimal** — `lucidchart.document.content:readonly` only.
- The `SESSION_SECRET` in `.env.example` is labelled "change in prod". For this
  dev server, any random string works.

---

## 17. Known Debt / Future Production Considerations

1. **`lucid-server` is a dev tool only.** Production deployments replace it with a
   proper edge function (Vercel, Cloudflare Workers) with a persistent session store
   (Redis, KV). The browser-side code (`LucidDiagramWidget`, `client.ts`, `cache.ts`)
   is production-ready and requires no changes.

2. **In-memory sessions** do not survive server restarts. During development this is
   fine (just re-authenticate). In production, use a persistent session store.

3. **`localStorage` cache** is scoped to the browser tab's origin. Multiple concurrent
   presentation tabs share the cache, which is beneficial. The cache is never
   explicitly cleared except by `evictCachedDocument`. A future cleanup pass should
   evict entries older than N days.

4. **The Lucid document contents API format is undocumented** and may change. The
   `types.ts` definitions in `lucid/` use permissive types (`unknown` fields) and the
   converter is defensive by design. If Lucid changes their internal format, the
   converter's `console.warn` on unknown shape types will surface the issue.

5. **`LucidDiagramWidget` bypasses the SceneTrack** by holding `liveState` outside the
   pre-baked animation data. This means `LucidDiagram` elements cannot participate in
   timeline-driven transitions (enter/exit animations) in v1. Full integration requires
   a mechanism to inject a new `SceneTrack` segment once loading completes — tracked as
   future work.

6. **`import-lucid.mjs` remains unchanged.** The converter in `lucid/converter.ts` is
   a browser-compatible port sharing the same logic. If the shape map or coordinate
   conventions change, both files must be updated. They should eventually share a
   common `LUCID_SHAPE_MAP` constant exported from a shared location (e.g.,
   `packages/diagram/src/lucid/shapeMap.ts`).

---

## 18. Document Picker Widget

### 18.1 Overview

`<LucidDocumentPicker>` is a self-contained React modal that lets the presenter
browse, search, filter, and select a document before it loads. It lives in
`packages/diagram/src/lucid/picker/` and is exported from `@brewsite/diagram`.

### 18.2 Lucid Search API

Search is powered by `POST https://api.lucid.co/documents/search`.

**Request body fields:**
- `keywords` — full-text search; if absent, returns most recent documents
- `product` — `'lucidchart'` | `'lucidspark'` | `'lucidscale'`
- `pageSize` — default 20, max 200
- `pageToken` — opaque pagination token from previous response

**Response fields per document:**
`documentId`, `title`, `product`, `created`, `lastModified`, `pageCount`, `canEdit`, `viewUrl`, `editUrl`, `owner`

No thumbnail URL is returned by the API.

**Pagination:** token-based via `Link: <url>; rel="next"` response header.

### 18.3 New Server Route

**File:** `packages/lucid-server/src/routes/search.ts`
**Endpoint:** `POST /api/lucid/search`

Receives `{ keywords?, product?, pageSize?, pageToken? }` from the browser,
forwards to `POST https://api.lucid.co/documents/search` with the session Bearer
token, extracts the next-page token from the `Link` response header, and returns
`{ documents: LucidDocumentSummary[], nextPageToken: string | null }`.

Mounted in `server.ts` **before** `createProxyRouter` at `/api/lucid/search`
(specific route must precede the wildcard `/:documentId` route).

### 18.4 New Browser Files

| File | Purpose |
|---|---|
| `packages/diagram/src/lucid/searchTypes.ts` | `LucidDocumentSummary`, `LucidSearchRequest`, `LucidSearchResponse` types |
| `packages/diagram/src/lucid/client.ts` | `searchLucidDocuments()` added alongside `fetchLucidPage()` |
| `packages/diagram/src/lucid/picker/LucidDocumentPicker.tsx` | React modal component |
| `packages/diagram/src/lucid/picker/index.ts` | Re-exports |
| `packages/diagram/src/lucid/useLucidDiagram.ts` | React hook: fetch+convert+compile pipeline |

### 18.5 `useLucidDiagram` Hook

```typescript
function useLucidDiagram(
  documentId: string | null,
  pageIndex: number,
  opts?: { scale?, pivot?, theme? }
): { diagramState, status, errorMessage, retry }
```

Handles the full async chain (fetch → cache check → convert → compile → cache write).
Returns `null` while loading. Status is a discriminated union:
`'idle' | 'loading' | 'loaded' | 'error:auth' | 'error:fetch' | 'error:other'`.

### 18.6 Picker UX

- **Dark glass aesthetic** matching `darkGlassTheme` palette
- **Modal overlay** with backdrop blur; Escape key or outside-click to dismiss
- **Search input** with 350ms debounce; no debounce on initial load or filter change
- **Product filter tabs:** All / Lucidchart / Lucidspark
- **Document grid:** auto-fill columns, each card shows title, product badge, last modified, page count, read-only indicator
- **Multi-page selector:** expands inline when a multi-page document is selected; chip buttons for each page
- **Pagination:** "Load more documents" button at bottom of grid; appears when `nextPageToken` is present
- **Footer confirm strip:** shows selected document name + page; "Use this document →" CTA; disabled until selection is made
- **Keyboard:** Enter to confirm, Escape to dismiss

### 18.7 `LucidPickerPage` Example Route

**Route:** `/lucid`
**File:** `apps/examples/lucid-picker/pages/LucidPickerPage.tsx`

Wraps in `LucidAuthGate`. URL state holds `?doc=ID&page=N`. Uses `useLucidDiagram`
to compile the selected document and feeds the resulting `DiagramState` directly
into a `ScenePlayer` via `buildPreviewScene()` / `buildPreviewWidgetSetup()` helpers.
`ScenePlayer` is keyed by `${documentId}:${pageIndex}` so it fully remounts on
selection change.

**Layout:**
```
┌──────────────────────────────────┐
│  ◈ Lucid Document Viewer    [btn]│  ← header bar
├──────────────────────────────────┤
│                                  │
│   Empty state / loading /        │
│   3D ScenePlayer preview         │  ← fills remaining height
│                                  │
└──────────────────────────────────┘
    [LucidDocumentPicker modal overlay on demand]
```