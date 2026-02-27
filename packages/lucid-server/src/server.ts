// Express app factory. Exported separately from index.ts for testability.
// All routes are mounted here; no listening happens in this file.

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import type { ServerConfig } from './config.js';
import { createAuthRouter } from './routes/auth.js';
import { createProxyRouter } from './routes/proxy.js';
import { createSearchRouter } from './routes/search.js';
import { createFoldersRouter } from './routes/folders.js';

// Extend express-session types with the fields we store
declare module 'express-session' {
  interface SessionData {
    accessToken:    string;
    refreshToken:   string;
    tokenExpiresAt: number;
    oauthState:     string;
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
      secure: false,          // http is fine in dev; set true in production (HTTPS)
      maxAge: 8 * 60 * 60 * 1000,  // 8 hours — enough for a full presentation day
    },
  }));

  app.use(express.json());

  app.use('/auth',             createAuthRouter(config));
  app.use('/api/lucid/search', createSearchRouter(config));   // specific routes before /:documentId
  app.use('/api/lucid/folders', createFoldersRouter(config));
  app.use('/api/lucid',        createProxyRouter(config));

  return app;
}
