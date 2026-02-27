// Entry point: load .env, validate config, create server, start listening.

import 'dotenv/config';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const app = createServer(config);

app.listen(config.port, () => {
  console.log(`[lucid-server] Listening on http://localhost:${config.port}`);
  console.log(`[lucid-server] Redirect URI:   ${config.redirectUri}`);
  console.log(`[lucid-server] App URL:        ${config.appUrl}`);
});
