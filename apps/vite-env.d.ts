/// <reference types="vite/client" />
/// <reference path="../packages/core/src/types/animejs.d.ts" />
/// <reference path="../packages/core/src/types/process.d.ts" />
/// <reference path="../packages/diagram/src/troika-three-text.d.ts" />

// MDX file imports — compiled to React components by @mdx-js/rollup.
declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const MDXComponent: ComponentType<{ components?: Record<string, ComponentType<Record<string, unknown>>> }>;
  export default MDXComponent;
}
