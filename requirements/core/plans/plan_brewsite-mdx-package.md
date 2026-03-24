---
title: "@brewsite/mdx — Runtime MDX Rendering for Dynamic Docs"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-23
---

# @brewsite/mdx — Runtime MDX Rendering for Dynamic Docs

## 1. Problem Statement

Docs teams need to serve dynamic MDX content (fetched from APIs, CMS, databases) with embedded BrewSite 3D scenes. The current options are:

- **Build-time MDX** (`@mdx-js/rollup`) — requires Vite plugin config, `enforce:'pre'` hack, `.mdx` type declarations, remark-gfm in vite config. Content must exist at build time.
- **`react-markdown`** — runtime, but no JSX support. Can't write `<SceneEmbed>` in content.
- **Raw `@mdx-js/mdx` `evaluate()`** — works but requires wiring `jsx-runtime`, remark plugins, component maps, async state, error handling, and caching. Every consumer reimplements this.

### Goal

A single `<BrewSiteMdx>` component that:
1. Takes an MDX string from any source (fetch, CMS, prop)
2. Compiles it in the browser at runtime — zero build plugins
3. Pre-registers all BrewSite components (SceneEmbed, Diagram DSL, etc.)
4. Maps standard markdown elements to `@brewsite/docs` components (CodeBlock, Callout, etc.)
5. Extracts frontmatter and heading TOC for the host page
6. Handles loading, errors, and caching transparently
7. Injects theme and plugin config into all embedded scenes

---

## 2. Package Structure

```
packages/mdx/
  src/
    BrewSiteMdx.tsx          — Main component
    useMdxCompile.ts         — Async compile + evaluate + cache hook
    useMdxFetch.ts           — Fetch MDX from URL + compile hook
    frontmatter.ts           — YAML frontmatter parser
    toc.ts                   — Heading TOC extractor (remark plugin)
    defaultComponents.ts     — BrewSite + docs component map
    types.ts                 — Public type contracts
    index.ts                 — Re-exports
    __tests__/
      useMdxCompile.test.ts
      frontmatter.test.ts
      toc.test.ts
  package.json
  tsconfig.json
  README.md
```

---

## 3. Dependencies

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
  },
  "optionalPeerDependencies": {
    "@brewsite/diagram": ">=0.7.0",
    "@brewsite/model": ">=0.7.0",
    "@brewsite/charts": ">=0.7.0",
    "@brewsite/docs": ">=0.7.0"
  }
}
```

`@mdx-js/mdx` is a **peer dependency** — the consumer installs it explicitly. This keeps `@brewsite/mdx` lightweight for bundlers that tree-shake peer deps, and makes the MDX compiler version the consumer's choice.

`@brewsite/docs` is optional — when installed, markdown elements auto-map to `CodeBlock`, `Callout`, `PropTable`. When absent, sensible HTML defaults are used.

---

## 4. Public API

### 4.1 `<BrewSiteMdx>` — Main Component

```typescript
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

**Usage — fetch from API:**
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

**What the MDX content looks like (no imports needed):**
```mdx
---
title: Authentication Architecture
author: Platform Team
---

# Authentication Architecture

The diagram below shows the auth flow:

<SceneEmbed height={380} interactive>
  <Scene id="auth-flow">
    <Diagram id="auth" x={0} y={0} w="100%" h="100%">
      <DiagramNode id="client" label="Client" shape="rectangle" />
      <DiagramNode id="gateway" label="Gateway" shape="hexagon" />
      <DiagramEdge from="client" to="gateway" label="Request" />
    </Diagram>
  </Scene>
</SceneEmbed>

> **Note:** The gateway validates tokens before forwarding.

## Code Example

```typescript
const token = await auth.getToken();
const response = await fetch('/api/data', {
  headers: { Authorization: `Bearer ${token}` },
});
```
```

Note: the MDX author writes `<SceneEmbed>` without `plugins` or `theme` — those are injected by `BrewSiteMdx` via the component map.

### 4.2 `useMdxCompile` — Compile Hook

For consumers who want more control over the compilation lifecycle (custom caching, pre-compilation, etc.):

```typescript
export interface UseMdxCompileResult {
  /** The compiled React component, or null while compiling. */
  Content: React.ComponentType<{ components?: Record<string, React.ComponentType> }> | null;
  /** Compilation error, if any. */
  error: Error | null;
  /** Whether compilation is in progress. */
  isCompiling: boolean;
  /** Extracted frontmatter (empty object if none). */
  frontmatter: Record<string, unknown>;
  /** Extracted heading TOC. */
  toc: TocEntry[];
}

/**
 * Compiles an MDX string to a React component in the browser.
 * Caches results by source string hash — recompilation only on source change.
 */
export function useMdxCompile(source: string | null): UseMdxCompileResult;
```

### 4.3 `useMdxFetch` — Fetch + Compile Hook

Convenience hook for the common "fetch MDX from a URL" pattern:

```typescript
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

/**
 * Fetches MDX content from a URL and compiles it to a React component.
 * Caches both the fetched source and the compiled result.
 */
export function useMdxFetch(url: string | null, options?: UseMdxFetchOptions): UseMdxFetchResult;
```

**Usage:**
```tsx
import { BrewSiteMdx, useMdxFetch } from '@brewsite/mdx';

function DocsPage({ slug }: { slug: string }) {
  const { Content, toc, isFetching, isCompiling, error } = useMdxFetch(`/api/docs/${slug}`);

  if (isFetching) return <PageSkeleton />;
  if (error) return <ErrorPage error={error} />;
  if (isCompiling || !Content) return <ContentSkeleton />;

  return (
    <div className="docs-layout">
      <Sidebar toc={toc} />
      <main>
        <Content components={defaultComponents} />
      </main>
    </div>
  );
}
```

---

## 5. Default Component Map

The component map determines what markdown syntax and JSX tags render as. `BrewSiteMdx` merges three layers (lowest → highest priority):

### Layer 1: HTML element defaults (always present)

Standard markdown → React element mapping with sensible styling:

```typescript
const htmlDefaults = {
  h1: (props) => <h1 id={slugify(props.children)} {...props} />,
  h2: (props) => <h2 id={slugify(props.children)} {...props} />,
  h3: (props) => <h3 id={slugify(props.children)} {...props} />,
  // h4, h5, h6 similarly...
  table: (props) => <div className="bw-mdx-table-wrapper"><table {...props} /></div>,
  a: (props) => <a target={isExternal(props.href) ? '_blank' : undefined} {...props} />,
};
```

Heading elements get auto-generated `id` attributes from their text content (slugified) for anchor linking. This is what `onToc` reads.

### Layer 2: `@brewsite/docs` components (when installed)

When `@brewsite/docs` is available, fenced code blocks and blockquotes map to the existing docs components:

```typescript
const docsComponents = {
  // Fenced code → CodeBlock with syntax highlighting
  pre: ({ children }) => {
    const code = extractCodeProps(children);
    return <CodeBlock language={code.language} code={code.content} />;
  },
  // Blockquotes with **Note:**/**Warning:**/**Tip:** prefix → Callout
  blockquote: ({ children }) => {
    const callout = detectCalloutType(children);
    if (callout) return <Callout type={callout.type}>{callout.content}</Callout>;
    return <blockquote>{children}</blockquote>;
  },
};
```

Detection: `@brewsite/docs` availability is checked via a dynamic import at compile time. If not installed, these mappings are omitted and standard HTML elements are used.

### Layer 3: BrewSite scene components (always present)

JSX tags in MDX content map to real BrewSite components with injected config:

```typescript
function createBrewSiteComponents(plugins, theme) {
  return {
    // SceneEmbed with auto-injected plugins + theme
    SceneEmbed: (props) => <SceneEmbed plugins={plugins} theme={theme} {...props} />,

    // Scene DSL — direct pass-through
    Scene,

    // Diagram DSL — available without imports in MDX
    Diagram,
    DiagramNode,
    DiagramEdge,
    DiagramGroup,
    FlowLayout,

    // Model DSL (when @brewsite/model is installed)
    // ...detected via optional peer dep
  };
}
```

### Layer 4: Consumer overrides (from `components` prop)

Anything the consumer passes in `components` overrides all layers above.

---

## 6. Compilation Pipeline

### 6.1 `useMdxCompile` internals

```
source string
    │
    ├── 1. Hash source → check cache → return cached if hit
    │
    ├── 2. evaluate(source, {
    │       ...jsxRuntime,
    │       remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
    │       rehypePlugins: [rehypeSlug],  // auto-generate heading ids
    │   })
    │
    ├── 3. Extract frontmatter from module exports
    │
    ├── 4. Extract TOC by walking rendered heading elements
    │       (remark plugin collects { depth, text, id } during compilation)
    │
    ├── 5. Cache compiled Component + frontmatter + toc
    │
    └── 6. Return { Content, frontmatter, toc }
```

### 6.2 Caching strategy

Cache is a module-level `Map<string, CacheEntry>` keyed by a fast hash of the source string (FNV-1a or similar). Cache entries hold:
- The compiled React component
- Extracted frontmatter
- Extracted TOC
- Compilation timestamp

Cache is **never invalidated by time** — only by source change. If the same source string is compiled again, the cached result is returned synchronously (no async, no flash). This means navigating back to a previously viewed doc page is instant.

Cache size is bounded (LRU, default 50 entries) to prevent memory growth on long sessions.

### 6.3 Error handling

Compilation errors from `evaluate()` are caught and surfaced via:
- `useMdxCompile` → `{ error: Error }`
- `BrewSiteMdx` → `errorFallback` component prop

The error includes the MDX source line/column from the compiler's diagnostic. The default error fallback renders:
```
⚠ MDX compilation error
Line 42: Unexpected token '<' — did you forget to close a JSX tag?

[source snippet with highlighted error line]
```

Runtime errors (e.g., a component throws during rendering) are NOT caught by `BrewSiteMdx` — the consumer should use a React error boundary above it.

---

## 7. TOC Extraction

Headings are extracted during compilation via a custom remark plugin that collects heading nodes from the AST:

```typescript
function remarkToc() {
  return (tree: Root, file: VFile) => {
    const headings: FlatHeading[] = [];
    visit(tree, 'heading', (node) => {
      const text = toString(node);
      const id = slugify(text);
      headings.push({ depth: node.depth, text, id });
    });
    file.data.toc = nestHeadings(headings);
  };
}
```

`nestHeadings` converts the flat list to a tree: h2s are top-level, h3s nest under the preceding h2, h4s under the preceding h3, etc. h1 is excluded (it's the page title, not a TOC entry).

The consumer receives `TocEntry[]` via `onToc` callback or `useMdxCompile().toc`.

---

## 8. Frontmatter

YAML frontmatter is extracted via `remark-frontmatter` + `remark-mdx-frontmatter`:

```mdx
---
title: Authentication Architecture
author: Platform Team
status: published
tags: [security, architecture]
---

# Authentication Architecture
...
```

Parsed frontmatter is available as:
- `useMdxCompile().frontmatter` → `{ title: 'Authentication Architecture', author: 'Platform Team', ... }`
- `BrewSiteMdx` `onFrontmatter` callback

No schema validation is applied — the consumer defines their own frontmatter shape. The type is `Record<string, unknown>`.

---

## 9. Theme Integration

The `theme` prop on `BrewSiteMdx` flows into two places:

1. **SceneEmbed instances** — via the component map override:
   ```typescript
   SceneEmbed: (props) => <SceneEmbed theme={theme} plugins={plugins} {...props} />
   ```
   MDX authors can still override per-embed: `<SceneEmbed theme={{ family: 'neonCyber' }}>` — their prop wins because `{...props}` spreads after the default.

2. **CSS class on wrapper div** — `BrewSiteMdx` adds `bw-dark`/`bw-light` and `bw-theme-{family}` classes to its outer div, matching `EngineOverlayHost`'s pattern. This lets the docs site's CSS variables scope to the content area.

---

## 10. Implementation Sequence

### Step 1: Scaffold package

Create `packages/mdx/` with `package.json`, `tsconfig.json`, `src/index.ts`. Add to Turborepo pipeline and pnpm workspace.

### Step 2: `types.ts`

Define `BrewSiteMdxProps`, `TocEntry`, `UseMdxCompileResult`, `UseMdxFetchResult`.

### Step 3: `frontmatter.ts`

Tiny YAML frontmatter extractor. Used as a pre-pass to strip frontmatter before `evaluate()` if `remark-mdx-frontmatter` integration requires it.

### Step 4: `toc.ts`

Custom remark plugin + `nestHeadings` utility + `slugify` function. Pure functions, fully testable.

### Step 5: `useMdxCompile.ts`

The core hook. Async `evaluate()` with remark plugins, cache, frontmatter/TOC extraction, error handling. Test with mock `evaluate()`.

### Step 6: `useMdxFetch.ts`

Thin wrapper: `fetch()` → `useMdxCompile()`. Separate fetch vs. compile error states.

### Step 7: `defaultComponents.ts`

Build the three-layer component map. Detect `@brewsite/docs` availability. Create the BrewSite component wrappers with plugin/theme injection.

### Step 8: `BrewSiteMdx.tsx`

Compose `useMdxCompile` + `defaultComponents` + error/loading states into the main component.

### Step 9: Tests

| Module | Test strategy |
|---|---|
| `toc.ts` | Pure function: input heading list → assert nested TOC tree |
| `frontmatter.ts` | Pure function: input MDX string → assert extracted YAML |
| `useMdxCompile` | Mock `evaluate()`, assert state transitions (compiling → ready, compiling → error), assert caching (same source → no recompile) |
| `useMdxFetch` | Mock `fetch()` + `evaluate()`, assert fetch → compile → ready pipeline |
| `defaultComponents` | Assert component map keys, assert plugin/theme injection on SceneEmbed |

### Step 10: Update example

Convert `apps/examples/src/mdx-embed/` to use `<BrewSiteMdx>` instead of the build-time `@mdx-js/rollup` pipeline. Remove the Vite MDX plugin, `remark-gfm` from vite config, and the `*.mdx` type declaration. The MDX content moves from a `.mdx` file to a `.ts` string export (or a fetched resource).

---

## 11. What This Package Does NOT Do

1. **Full docs framework** — no routing, no sidebar, no search. Use `@brewsite/docs` for layout.
2. **Server-side compilation** — this is a browser-only runtime package. For SSR, use `@mdx-js/mdx` `compile()` on the server directly.
3. **File-system MDX** — no `.mdx` file loading. Content comes as strings from the consumer.
4. **MDX import statements** — `import { Foo } from './bar'` in MDX content is not supported (no filesystem access in the browser). All components must be provided via the `components` prop / built-in map.
5. **Bundling** — no esbuild/webpack for MDX content. If MDX needs to import npm packages, use `mdx-bundler` instead.
