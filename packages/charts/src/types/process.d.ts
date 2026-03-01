// Minimal process.env ambient declaration for build-time dead-code elimination.
// Mirrors packages/core/src/types/process.d.ts — required when typechecking against core source.
declare const process: {
  readonly env: {
    readonly NODE_ENV: string;
  };
};
