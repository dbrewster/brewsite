// Type declaration for process.env.NODE_ENV, which Vite statically replaces
// in bundled output enabling dead-code elimination of dev-only guards.
// Only NODE_ENV is declared — no other Node.js globals are used in this library.
declare const process: {
  readonly env: {
    readonly NODE_ENV: string | undefined;
  };
};
