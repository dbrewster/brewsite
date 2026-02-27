// Loads and validates server configuration from process.env.
// Call loadConfig() at startup. Throws immediately if required variables are
// missing so misconfiguration is obvious before any request is handled.

export interface ServerConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly appUrl: string;
  readonly port: number;
  readonly sessionSecret: string;
}

export function loadConfig(): ServerConfig {
  const required = [
    'LUCID_CLIENT_ID',
    'LUCID_CLIENT_SECRET',
    'SESSION_SECRET',
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `Missing required environment variable: ${key}. ` +
        'Copy packages/lucid-server/.env.example to .env and fill it in.',
      );
    }
  }

  return {
    clientId:      process.env['LUCID_CLIENT_ID']!,
    clientSecret:  process.env['LUCID_CLIENT_SECRET']!,
    redirectUri:   process.env['LUCID_REDIRECT_URI'] ?? 'http://localhost:5173/auth/callback',
    appUrl:        process.env['APP_URL'] ?? 'http://localhost:5173',
    port:          Number(process.env['PORT'] ?? 3001),
    sessionSecret: process.env['SESSION_SECRET']!,
  };
}
