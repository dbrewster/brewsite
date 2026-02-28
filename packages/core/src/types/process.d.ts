// Minimal process.env ambient declaration.
// Provides process.env.NODE_ENV for build-time dead-code elimination by Vite and other bundlers.
// Full @types/node is intentionally excluded — this library targets browsers only.
declare const process: {
  readonly env: {
    readonly NODE_ENV: string;
  };
};
