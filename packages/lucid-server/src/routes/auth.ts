// OAuth 2.0 Authorization Code flow routes.
//
//  GET /auth/login     → redirect to Lucid authorization page
//  GET /auth/callback  → exchange code for token, store in session, redirect to app
//  GET /auth/logout    → destroy session
//  GET /auth/status    → { authenticated: boolean }

import { Router } from 'express';
import type { ServerConfig } from '../config.js';

const LUCID_AUTH_URL  = 'https://lucid.app/oauth2/authorize';
const LUCID_TOKEN_URL = 'https://api.lucid.co/oauth2/token';
// Request read access across all three Lucid products plus folder traversal.
// folder:readonly is required to browse "Shared with me" via the folder tree,
// since /documents/search only returns documents the user personally owns.
const LUCID_SCOPE =
  'lucidchart.document.content:readonly ' +
  'lucidspark.document.content:readonly ' +
  'lucidscale.document.content:readonly ' +
  'folder:readonly';

export function createAuthRouter(config: ServerConfig): Router {
  const router = Router();

  // ── GET /auth/login ────────────────────────────────────────────────────────
  // Generates a per-request CSRF state, stores it in the session, then redirects
  // to Lucid's authorization endpoint.
  router.get('/login', (req, res) => {
    const state = crypto.randomUUID();
    req.session.oauthState = state;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     config.clientId,
      redirect_uri:  config.redirectUri,
      scope:         LUCID_SCOPE,
      state,
    });

    res.redirect(`${LUCID_AUTH_URL}?${params.toString()}`);
  });

  // ── GET /auth/callback ────────────────────────────────────────────────────
  // Lucid redirects here with ?code=...&state=...
  // Exchange the code for tokens and store them in the session.
  router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      console.error(`[auth/callback] Lucid returned error: ${error}`);
      res.redirect(`${config.appUrl}?lucid_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    if (state !== req.session.oauthState) {
      res.status(400).send('CSRF state mismatch');
      return;
    }

    try {
      const tokenResp = await fetch(LUCID_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:   'authorization_code',
          code,
          redirect_uri:  config.redirectUri,
          client_id:     config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });

      if (!tokenResp.ok) {
        const body = await tokenResp.text();
        console.error(`[auth/callback] Token exchange failed (${tokenResp.status}): ${body}`);
        res.redirect(`${config.appUrl}?lucid_error=token_exchange_failed`);
        return;
      }

      const tokens = await tokenResp.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      req.session.accessToken    = tokens.access_token;
      req.session.refreshToken   = tokens.refresh_token;
      req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
      delete req.session.oauthState;

      res.redirect(config.appUrl);
    } catch (err) {
      console.error('[auth/callback] Unexpected error:', err);
      res.redirect(`${config.appUrl}?lucid_error=server_error`);
    }
  });

  // ── GET /auth/logout ──────────────────────────────────────────────────────
  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // ── GET /auth/status ──────────────────────────────────────────────────────
  // Safe to poll from the browser on every page mount.
  router.get('/status', (req, res) => {
    res.json({ authenticated: !!req.session.accessToken });
  });

  return router;
}
