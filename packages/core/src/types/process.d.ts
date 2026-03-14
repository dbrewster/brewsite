// Minimal process.env type declaration for browser/Vite library builds.
// Vite replaces process.env.NODE_ENV at bundle time; this satisfies tsc without
// pulling in all of @types/node into a browser-targeted package.
declare const process: {
  env: Record<string, string | undefined>;
};
