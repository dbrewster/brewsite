---
title: "@brewsite/mdx — Runtime MDX Rendering for Dynamic Content"
doc_type: prd
status: draft
owner: Toolkit Product
last_updated: 2026-03-23
change_history:
  - date: 2026-03-23
    author: "Toolkit Product"
    summary: "Initial PRD created. Defines the @brewsite/mdx package: runtime browser-side MDX compilation, <BrewSiteMdx> component, useMdxCompile/useMdxFetch hooks, frontmatter + TOC extraction, pre-registered BrewSite component map, theme/plugin injection into embedded scenes."
---

# `@brewsite/mdx` — Runtime MDX Rendering for Dynamic Content

---

## 1. Overview

`@brewsite/mdx` is a published npm package that provides runtime MDX compilation in the browser. Content authors write MDX strings — fetched from APIs, CMS platforms, databases, or passed as props — and the package compiles and renders them client-side with pre-registered BrewSite components (`SceneEmbed`, Diagram DSL, etc.) and optional `@brewsite/docs` content primitives (`CodeBlock`, `Callout`).

The package eliminates the need for build-time MDX plugins (e.g., `@mdx-js/rollup` with Vite config, `.mdx` type declarations, remark plugins in vite.config) when content is dynamic. A single `<BrewSiteMdx source={mdxString} />` component handles compilation, caching, error handling, frontmatter extraction, TOC generation, and BrewSite component injection.

**Affected packages:** `packages/mdx` (`@brewsite/mdx`). Integrates with `@brewsite/core`, `@brewsite/diagram` (optional), `@brewsite/model` (optional), `@brewsite/charts` (optional), and `@brewsite/docs` (optional).

---

## 2. Problem Statement

Documentation teams and content-driven applications need to serve dynamic MDX content with embedded BrewSite 3D scenes. The current options each have significant drawbacks:

- **Build-time MDX** (`@mdx-js/rollup`) requires Vite plugin configuration, `enforce: 'pre'` workarounds, `.mdx` type declarations, and remark-gfm in vite config. Content must exist at build time — runtime-fetched content cannot use this path.
- **`react-markdown`** supports runtime rendering but has no JSX support. MDX authors cannot write `<SceneEmbed>`, `<Diagram>`, or any custom component in their content.
- **Raw `@mdx-js/mdx` `evaluate()`** works at runtime but requires consumers to wire `jsx-runtime`, remark plugins, component maps, async state management, error handling, and caching. Every consuming application reimplements this integration layer.

The common pattern across BrewSite consumers is: fetch MDX from a backend, compile it in the browser, render it with BrewSite components pre-registered, and extract frontmatter + headings for page chrome. This package standardizes that pattern.

---

## 3. Goals & Success Metrics

**Goals:**
- A single `<BrewSiteMdx>` component that takes an MDX string and renders it with BrewSite components available, zero build plugins required
- Automatic plugin and theme injection into all embedded `<SceneEmbed>` instances
- Frontmatter extraction and heading TOC generation as first-class features
- Transparent caching: revisiting previously compiled content is synchronous
- Graceful error handling with source-line-level diagnostics

**Primary Metrics:**
- Integration requires 1 import and 1 component vs. the current 5+ files of boilerplate
- Bundle size delta: < 5 KB gzipped for `@brewsite/mdx` itself (excludes `@mdx-js/mdx` peer dep)
- Compilation latency: < 50 ms for a typical 500-line MDX document on modern hardware
- Cache hit returns synchronously (no async, no loading flash)

**Guardrail Metrics:**
- No regression to existing `@brewsite/core` or `@brewsite/diagram` API consumers
- No new peer dependency on `@brewsite/core` consumers who do not use `@brewsite/mdx`
- `pnpm typecheck` passes across all packages after integration

---

## 4. Non-Goals

- **Full docs framework**: No routing, sidebar, search, or page layout. Use `@brewsite/docs` for documentation site infrastructure.
- **Server-side compilation**: This is a browser-only runtime package. For SSR, consumers use `@mdx-js/mdx` `compile()` on the server directly.
- **File-system MDX loading**: No `.mdx` file import support. Content arrives as strings from the consumer.
- **MDX `import` statements**: `import { Foo } from './bar'` in MDX content is not supported — there is no filesystem access in the browser. All components are provided via the built-in component map or the `components` prop.
- **MDX bundling**: No esbuild/webpack for MDX content. If MDX content needs to import npm packages at runtime, consumers should use `mdx-bundler` instead.
- **Schema validation of frontmatter**: The package extracts frontmatter as `Record<string, unknown>`. Shape validation is the consumer's responsibility.
- **Custom remark/rehype plugin injection**: The initial release uses a fixed plugin pipeline. Consumer-supplied remark/rehype plugins are a potential future extension.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to render MDX content fetched from my CMS with embedded BrewSite scenes so that my documentation pages include interactive 3D diagrams without build-time MDX plugins.
- As a toolkit consumer, I want BrewSite components (`SceneEmbed`, `Diagram`, `DiagramNode`, etc.) to be available in MDX content without explicit imports so that content authors do not need to know the npm package structure.
- As a toolkit consumer, I want my global `plugins` and `theme` configuration to be injected automatically into all `<SceneEmbed>` instances in the MDX content so that content authors do not need to pass configuration props.
- As a toolkit consumer, I want to extract the heading hierarchy from MDX content so that I can render a table-of-contents sidebar.
- As a toolkit consumer, I want YAML frontmatter parsed and returned as a typed object so that I can use document metadata (title, author, tags) in my page layout.
- As a toolkit consumer, I want MDX compilation errors to show source line/column information so that content authors can debug syntax issues.
- As a toolkit consumer, I want previously compiled content to render instantly (no loading flash) when navigating back to a page so that the browsing experience feels native.

---

## 6. Functional Requirements

1. The system shall export a `<BrewSiteMdx>` React component that accepts an MDX source string and renders the compiled output.
2. The system shall compile MDX source strings in the browser at runtime using `@mdx-js/mdx` `evaluate()` with the React JSX runtime.
3. The system shall pre-register BrewSite scene components (`SceneEmbed`, `Scene`, `Diagram`, `DiagramNode`, `DiagramEdge`, `DiagramGroup`, `FlowLayout`) in the MDX component map so that MDX authors can use them without import statements.
4. The system shall inject the `plugins` and `theme` props from `<BrewSiteMdx>` into all `<SceneEmbed>` instances rendered from MDX content. MDX authors can override these per-instance; author-supplied props take precedence.
5. The system shall detect `@brewsite/docs` availability at compilation time. When installed, fenced code blocks map to `CodeBlock` and blockquotes with `**Note:**` / `**Warning:**` / `**Tip:**` prefixes map to `Callout`. When absent, standard HTML elements are used.
6. The system shall extract YAML frontmatter from the MDX source via `remark-frontmatter` and `remark-mdx-frontmatter`. Extracted frontmatter is available via the `onFrontmatter` callback and `useMdxCompile().frontmatter`.
7. The system shall extract a heading hierarchy (TOC) during compilation via a custom remark plugin. Headings are returned as a nested `TocEntry[]` tree via the `onToc` callback and `useMdxCompile().toc`.
8. The system shall cache compiled results by source string hash. Cache hits return synchronously. The cache is LRU-bounded (default 50 entries).
9. The system shall surface MDX compilation errors via `useMdxCompile().error` and the `errorFallback` prop on `<BrewSiteMdx>`. Error messages include source line/column information when available.
10. The system shall export a `useMdxCompile(source)` hook that returns `{ Content, error, isCompiling, frontmatter, toc }`.
11. The system shall export a `useMdxFetch(url, options?)` hook that fetches MDX content from a URL and compiles it. It returns the same fields as `useMdxCompile` plus `{ isFetching, fetchError }`.
12. The system shall apply `remark-gfm` by default so that GFM tables, strikethrough, autolinks, and task lists work in MDX content.
13. The system shall auto-generate `id` attributes on heading elements (slugified from heading text) for anchor linking.
14. The system shall add CSS classes `bw-dark`/`bw-light` and `bw-theme-{family}` to its outer wrapper div when a `theme` prop is provided, matching the `EngineOverlayHost` pattern.

---

## 7. API Design

### 7.1 `<BrewSiteMdx>` Component

```typescript
// packages/mdx/src/types.ts

import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';

export interface BrewSiteMdxProps {
  /**
   * MDX source string. Can contain JSX (SceneEmbed, Diagram, etc.),
   * standard markdown, GFM tables, and YAML frontmatter.
   */
  source: string;

  /**
   * WidgetPlugin array for all SceneEmbed instances in the content.
   * Injected automatically — MDX authors don't pass plugins to SceneEmbed.
   */
  plugins?: WidgetPlugin[];

  /**
   * Active theme for all SceneEmbed instances in the content.
   */
  theme?: ActiveTheme;

  /**
   * Additional React components available to MDX content.
   * Merged with the built-in BrewSite + docs component map.
   * Consumer components override built-ins with the same name.
   */
  components?: Record<string, React.ComponentType<any>>;

  /**
   * Called when frontmatter is extracted from the MDX source.
   * Fires after compilation, before first render.
   */
  onFrontmatter?: (frontmatter: Record<string, unknown>) => void;

  /**
   * Called with extracted heading hierarchy for TOC generation.
   * Fires after compilation, before first render.
   */
  onToc?: (headings: TocEntry[]) => void;

  /**
   * Content to show during MDX compilation (~10-30ms).
   * Default: null (render nothing until ready).
   */
  placeholder?: React.ReactNode;

  /**
   * Content to show when MDX compilation fails.
   * Receives the compilation error.
   * Default: a styled error message with the error text.
   */
  errorFallback?: React.ComponentType<{ error: Error }>;

  /**
   * CSS class applied to the outer wrapper div.
   */
  className?: string;
}

export interface TocEntry {
  /** Heading level (1-6). */
  depth: number;
  /** Text content of the heading. */
  text: string;
  /** Slugified id for anchor linking. */
  id: string;
  /** Nested child headings. */
  children: TocEntry[];
}
```

### 7.2 `useMdxCompile` Hook

```typescript
// packages/mdx/src/types.ts

export interface UseMdxCompileResult {
  /** The compiled React component, or null while compiling. */
  Content: React.ComponentType<{
    components?: Record<string, React.ComponentType>;
  }> | null;
  /** Compilation error, if any. */
  error: Error | null;
  /** Whether compilation is in progress. */
  isCompiling: boolean;
  /** Extracted frontmatter (empty object if none). */
  frontmatter: Record<string, unknown>;
  /** Extracted heading TOC. */
  toc: TocEntry[];
}

// packages/mdx/src/useMdxCompile.ts

/**
 * Compiles an MDX string to a React component in the browser.
 * Caches results by source string hash — recompilation only on source change.
 */
export function useMdxCompile(source: string | null): UseMdxCompileResult;
```

### 7.3 `useMdxFetch` Hook

```typescript
// packages/mdx/src/types.ts

export interface UseMdxFetchOptions {
  /** Fetch options (headers, credentials, etc.). */
  fetchOptions?: RequestInit;
  /** Revalidate when this key changes. */
  revalidateKey?: string | number;
}

export interface UseMdxFetchResult extends UseMdxCompileResult {
  /** Whether the fetch is in progress (before compilation starts). */
  isFetching: boolean;
  /** Fetch error (network, 404, etc.), separate from compilation error. */
  fetchError: Error | null;
}

// packages/mdx/src/useMdxFetch.ts

/**
 * Fetches MDX content from a URL and compiles it to a React component.
 * Caches both the fetched source and the compiled result.
 */
export function useMdxFetch(
  url: string | null,
  options?: UseMdxFetchOptions,
): UseMdxFetchResult;
```

### 7.4 Default Component Map

The component map merges four layers (lowest to highest priority):

**Layer 1 — HTML element defaults (always present):**
```typescript
const htmlDefaults = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 id={slugify(props.children)} {...props} />,
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 id={slugify(props.children)} {...props} />,
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 id={slugify(props.children)} {...props} />,
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h4 id={slugify(props.children)} {...props} />,
  h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h5 id={slugify(props.children)} {...props} />,
  h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h6 id={slugify(props.children)} {...props} />,
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="bw-mdx-table-wrapper"><table {...props} /></div>
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a target={isExternal(props.href) ? '_blank' : undefined} rel={isExternal(props.href) ? 'noopener noreferrer' : undefined} {...props} />
  ),
};
```

**Layer 2 — `@brewsite/docs` components (when installed):**
```typescript
const docsComponents = {
  pre: ({ children }: { children: React.ReactNode }) => {
    const code = extractCodeProps(children);
    return <CodeBlock language={code.language} code={code.content} />;
  },
  blockquote: ({ children }: { children: React.ReactNode }) => {
    const callout = detectCalloutType(children);
    if (callout) return <Callout type={callout.type}>{callout.content}</Callout>;
    return <blockquote>{children}</blockquote>;
  },
};
```

**Layer 3 — BrewSite scene components (always present):**
```typescript
function createBrewSiteComponents(
  plugins: WidgetPlugin[] | undefined,
  theme: ActiveTheme | undefined,
): Record<string, React.ComponentType<any>> {
  return {
    SceneEmbed: (props: any) => <SceneEmbed plugins={plugins} theme={theme} {...props} />,
    Scene,
    Diagram,
    DiagramNode,
    DiagramEdge,
    DiagramGroup,
    FlowLayout,
    // Additional components detected via optional peer deps at import time
  };
}
```

**Layer 4 — Consumer overrides (from `components` prop):**
Consumer-supplied components override all layers above.

### 7.5 Public Export Surface

```typescript
// packages/mdx/src/index.ts

export { BrewSiteMdx } from './BrewSiteMdx';
export { useMdxCompile } from './useMdxCompile';
export { useMdxFetch } from './useMdxFetch';
export type {
  BrewSiteMdxProps,
  TocEntry,
  UseMdxCompileResult,
  UseMdxFetchOptions,
  UseMdxFetchResult,
} from './types';
```

### 7.6 Usage Examples

**Fetch from API:**
```tsx
import { BrewSiteMdx } from '@brewsite/mdx';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

function DocsPage({ slug }: { slug: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const plugins = useMemo(() => [corePlugin(), diagramPlugin()], []);

  useEffect(() => {
    fetch(`/api/docs/${slug}`).then(r => r.text()).then(setSource);
  }, [slug]);

  if (!source) return <PageSkeleton />;

  return (
    <div className="docs-layout">
      <Sidebar toc={toc} />
      <main>
        <BrewSiteMdx
          source={source}
          plugins={plugins}
          theme={{ family: 'darkGlass', polarity: 'dark' }}
          onToc={setToc}
          placeholder={<ContentSkeleton />}
        />
      </main>
    </div>
  );
}
```

**Using `useMdxFetch` for lower-level control:**
```tsx
import { useMdxFetch } from '@brewsite/mdx';

function DocsPage({ slug }: { slug: string }) {
  const { Content, toc, isFetching, isCompiling, error } = useMdxFetch(
    `/api/docs/${slug}`,
  );

  if (isFetching) return <PageSkeleton />;
  if (error) return <ErrorPage error={error} />;
  if (isCompiling || !Content) return <ContentSkeleton />;

  return (
    <div className="docs-layout">
      <Sidebar toc={toc} />
      <main><Content /></main>
    </div>
  );
}
```

---

## 8. Technical Considerations

### 8.1 Package Structure

```
packages/mdx/
  src/
    BrewSiteMdx.tsx          -- Main component
    useMdxCompile.ts         -- Async compile + evaluate + cache hook
    useMdxFetch.ts           -- Fetch MDX from URL + compile hook
    frontmatter.ts           -- YAML frontmatter parser utility
    toc.ts                   -- Heading TOC extractor (remark plugin)
    defaultComponents.ts     -- BrewSite + docs component map
    types.ts                 -- Public type contracts
    index.ts                 -- Re-exports
    __tests__/
      useMdxCompile.test.ts
      frontmatter.test.ts
      toc.test.ts
  package.json
  tsconfig.json
  tsconfig.build.json
  README.md
```

### 8.2 Build

`@brewsite/mdx` builds with `tsc` only (same pattern as `@brewsite/diagram`, `@brewsite/docs`). No Vite bundle step. `tsconfig.build.json` excludes `__tests__/` directories.

### 8.3 Dependencies

```json
{
  "name": "@brewsite/mdx",
  "peerDependencies": {
    "@mdx-js/mdx": "^3.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "@brewsite/core": ">=0.7.0"
  },
  "dependencies": {
    "remark-gfm": "^4.0.0",
    "remark-frontmatter": "^5.0.0",
    "remark-mdx-frontmatter": "^4.0.0"
  }
}
```

**Peer dependency justification:**
- `@mdx-js/mdx` is a peer because it is a large dependency (~150 KB) and the consumer controls the version. Making it a peer allows deduplication when the consumer also uses MDX at build time.
- `react` follows the existing BrewSite peer dependency pattern.
- `@brewsite/core` is a peer because the package uses `SceneEmbed`, `WidgetPlugin`, and `ActiveTheme` types.

**Optional peer dependencies:**
- `@brewsite/diagram` — when installed, Diagram DSL components are added to the component map.
- `@brewsite/model` — when installed, Model DSL components are added to the component map.
- `@brewsite/charts` — when installed, Chart DSL components are added to the component map.
- `@brewsite/docs` — when installed, `CodeBlock` and `Callout` replace HTML defaults for fenced code blocks and blockquotes.

Optional peer detection uses dynamic `import()` with a try/catch fallback. Detection runs once at module load time and is cached.

### 8.4 Compilation Pipeline

```
source string
    |
    +-- 1. Hash source (FNV-1a) -> check cache -> return cached if hit
    |
    +-- 2. evaluate(source, {
    |       ...jsxRuntime,
    |       remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter, remarkToc],
    |   })
    |
    +-- 3. Extract frontmatter from module exports
    |
    +-- 4. Extract TOC from file.data.toc (set by remarkToc plugin)
    |
    +-- 5. Cache compiled Component + frontmatter + toc (LRU, 50 entries)
    |
    +-- 6. Return { Content, frontmatter, toc }
```

### 8.5 Caching Strategy

Cache is a module-level `Map<string, CacheEntry>` keyed by FNV-1a hash of the source string. Cache entries hold the compiled React component, extracted frontmatter, extracted TOC, and compilation timestamp.

Cache is never invalidated by time — only by source change or LRU eviction. Navigating back to a previously viewed document returns cached results synchronously (no async, no loading flash).

Cache size is bounded at 50 entries by default. When full, the least recently used entry is evicted.

### 8.6 Error Handling

Compilation errors from `evaluate()` are caught and surfaced via:
- `useMdxCompile` returns `{ error: Error }` with the compilation error
- `<BrewSiteMdx>` renders the `errorFallback` component with the error

The default error fallback renders a styled message with the error text and source line/column when available from the MDX compiler diagnostic.

Runtime errors (a component throws during rendering) are NOT caught by `<BrewSiteMdx>`. The consumer should use a React error boundary above it.

### 8.7 Tree-Shaking

All exports are named exports from `index.ts`. No side-effectful barrel imports. The `package.json` includes `"sideEffects": false` to enable tree-shaking.

Optional peer detection uses dynamic `import()` to avoid hard import edges that would prevent tree-shaking when optional peers are not installed.

### 8.8 Relationship to `@brewsite/docs`

`@brewsite/docs` provides documentation site infrastructure (layout, nav, sections, unified scroll). `@brewsite/mdx` provides runtime MDX compilation. They are complementary:

- `@brewsite/docs` defines `CodeBlock`, `Callout`, `PropTable` — `@brewsite/mdx` auto-maps these to markdown syntax when `@brewsite/docs` is installed.
- A documentation site can use both: `@brewsite/docs` for page layout and `@brewsite/mdx` for rendering CMS-sourced MDX content within that layout.
- Neither package depends on the other. `@brewsite/docs` is an optional peer of `@brewsite/mdx`.

---

## 9. Breaking Change Assessment

**Semver impact: none on existing published packages.**

`@brewsite/mdx` is a new package. No existing package changes its public API. The initial release is `0.1.0`.

No existing consumer code breaks. No migration path required.

---

## 10. Dependencies

| Dependency | Type | Justification |
|---|---|---|
| `@mdx-js/mdx` ^3.0.0 | peer | Core compilation engine; consumer controls version |
| `react` ^18 or ^19 | peer | Follows existing BrewSite peer pattern |
| `@brewsite/core` >=0.7.0 | peer | `SceneEmbed`, `WidgetPlugin`, `ActiveTheme` types |
| `remark-gfm` ^4.0.0 | runtime | GFM table, strikethrough, autolink, task list support |
| `remark-frontmatter` ^5.0.0 | runtime | YAML frontmatter parsing |
| `remark-mdx-frontmatter` ^4.0.0 | runtime | Frontmatter extraction to module exports |
| `@brewsite/diagram` >=0.7.0 | optional peer | Diagram DSL components in component map |
| `@brewsite/model` >=0.7.0 | optional peer | Model DSL components in component map |
| `@brewsite/charts` >=0.7.0 | optional peer | Chart DSL components in component map |
| `@brewsite/docs` >=0.7.0 | optional peer | `CodeBlock`, `Callout` mapping for markdown syntax |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `@mdx-js/mdx` bundle size (~150 KB) may concern consumers | Making it a peer dep lets consumers evaluate the tradeoff. Document the bundle impact in the README. |
| `evaluate()` latency on large documents | LRU cache ensures repeat views are instant. Benchmark 95th percentile at < 50 ms on a 500-line document. |
| API regret: locking in the `source` string prop model may not cover future streaming/chunked MDX | The `source: string` model is correct for the 90% case (CMS fetch, database fetch). Streaming can be added as a separate hook without breaking the existing API. |
| Optional peer detection via dynamic `import()` may not work in all bundler configurations | Document the bundler requirement (Vite, webpack 5, or any bundler that supports dynamic import). Fall back gracefully to HTML defaults when detection fails. |
| Component map grows unbounded as new BrewSite packages are added | The component map is constructed lazily from detected optional peers. New packages only appear when installed. The component map is not part of the bundle when the optional peer is absent. |
| Stale cache serves outdated content | Cache is keyed by source string hash. If the source changes, the old entry is not returned. No time-based invalidation means consumers must pass the updated source string. |

---

## 12. Open Questions

1. **Consumer-supplied remark/rehype plugins**: Should the initial release support a `remarkPlugins` / `rehypePlugins` prop on `<BrewSiteMdx>` for consumer customization? The plan currently uses a fixed plugin pipeline. Adding plugin injection is straightforward but increases API surface.

2. **Syntax highlighting in the default (no `@brewsite/docs`) path**: When `@brewsite/docs` is not installed, fenced code blocks render as plain `<pre><code>`. Should `@brewsite/mdx` include a lightweight syntax highlighter as a fallback, or is plain HTML acceptable for the no-docs case?

3. **Cache size configuration**: Should the LRU cache size (currently hardcoded at 50) be configurable via a prop or module-level configuration? The risk of exposing this is low, but it adds API surface.

---

## 13. Launch Criteria

- [ ] `packages/mdx/` scaffolded with `package.json`, `tsconfig.json`, `tsconfig.build.json`, `src/index.ts`
- [ ] `<BrewSiteMdx>` component implemented and exported
- [ ] `useMdxCompile` hook implemented with LRU caching and error handling
- [ ] `useMdxFetch` hook implemented with separate fetch/compile error states
- [ ] Frontmatter extraction working via `remark-frontmatter` + `remark-mdx-frontmatter`
- [ ] TOC extraction working via custom remark plugin with `nestHeadings` utility
- [ ] Default component map includes BrewSite scene components with plugin/theme injection
- [ ] Optional `@brewsite/docs` detection maps `CodeBlock` and `Callout` to markdown syntax
- [ ] Tests passing for `useMdxCompile`, `frontmatter`, `toc` modules
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm test` passes for `packages/mdx`
- [ ] Package added to `publish-all.mjs` script
- [ ] Package added to Turborepo pipeline
- [ ] README.md documents the component API, hooks, and integration pattern
- [ ] CHANGELOG entry written for v0.1.0
