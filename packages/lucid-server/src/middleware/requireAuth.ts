// Express middleware: rejects unauthenticated requests with 401.
// Also proactively refreshes the access token when it is within 60s of expiry.

import type { Request, Response, NextFunction } from 'express';
import type { ServerConfig } from '../config.js';

const LUCID_TOKEN_URL = 'https://api.lucid.co/oauth2/token';

export function requireAuth(config: ServerConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.accessToken) {
      res.status(401).json({ error: 'Not authenticated. Call /auth/login first.' });
      return;
    }

    // Proactively refresh if expiring within 60 seconds
    const expiresAt = req.session.tokenExpiresAt ?? 0;
    if (Date.now() > expiresAt - 60_000 && req.session.refreshToken) {
      try {
        const refreshResp = await fetch(LUCID_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: req.session.refreshToken,
            client_id:     config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
        });

        if (refreshResp.ok) {
          const tokens = await refreshResp.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
          };
          req.session.accessToken    = tokens.access_token;
          req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
          if (tokens.refresh_token) req.session.refreshToken = tokens.refresh_token;
        } else {
          console.warn('[requireAuth] Token refresh failed — clearing session');
          req.session.destroy(() => {});
          res.status(401).json({ error: 'Session expired. Re-authenticate at /auth/login.' });
          return;
        }
      } catch (err) {
        console.error('[requireAuth] Token refresh error:', err);
        res.status(500).json({ error: 'Token refresh error' });
        return;
      }
    }

    next();
  };
}
