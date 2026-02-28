---
title: "Documentation Site — @brewsite/core Book"
doc_type: plan
status: draft
owner: brewsite-product-manager
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial plan created. Full implementation blueprint for the @brewsite/core documentation book in the new apps/docs Vite app. Covers app scaffolding, layout, navigation, demo architecture, all doc pages, CSS design system, build system, and static hosting."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Incorporated resolved design decisions: location confirmed as apps/docs (separate workspace); model demos use MaleDummy GLB (motion-dummy_male.no-normals.glb) with ChatRelaxM and StandingChatM animations; base path set to /docs; light/dark theme toggle defaulting to system preference; Google Analytics behind .env gating with .env.template; auto-play demos trigger on scroll-into-view via IntersectionObserver, respecting prefers-reduced-motion; API reference auto-generated via TypeDoc; TimelineWidget documented (CameraControlPanel and SceneInspector excluded); favicon is dark-orange-to-lighter-orange BrewSite wordmark; no search in v1; single version tracking main."
---

# Documentation Site — @brewsite/core Book

## Overview

This plan covers the full implementation of the `@brewsite/core` documentation book within a new `apps/docs` Vite app in the monorepo. The docs site is a React SPA served statically (GitHub Pages or equivalent). Every doc page includes prose explanation, TypeScript code examples with syntax highlighting, and one or more **live embedded widget demos** — self-contained ScenePlayer instances that render the feature being documented directly in the browser.

This plan covers the `@brewsite/core` "book". The companion plan `plan_docs_diagram.md` covers the `@brewsite/diagram` book using the same infrastructure created here.

---

## 1. Monorepo Integration

### 1.1 New Workspace: `apps/docs`

Create `apps/docs/` as a new private workspace in the pnpm monorepo.

**`pnpm-workspace.yaml`** — add the `apps/docs` entry:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

(No change needed if `apps/*` is already present — confirm it is.)

**`turbo.json`** — the existing `build`, `dev`, `typecheck`, and `test` tasks already match `apps/*` via glob, so no turbo changes are needed.

### 1.2 Root-Level Script

Add to root `package.json` scripts section:

```json
"dev:docs": "turbo dev --filter=@brewsite/docs",
"build:docs": "turbo build --filter=@brewsite/docs"
```

---

## 2. `apps/docs` Package Setup

### 2.1 `apps/docs/package.json`

```json
{
  "name": "@brewsite/docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "gen:scene-dsl": "node ../../scripts/gen-scene-dsl.mjs --input siteResources.ts --out-dir src/generated --asset-root public --manifest-out public/scene-manifest.json"
  },
  "dependencies": {
    "@brewsite/core": "workspace:*",
    "@brewsite/diagram": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router": "^7.13.0",
    "three": "^0.183.1",
    "prism-react-renderer": "^2.4.1",
    "typedoc": "^0.27.0",
    "typedoc-plugin-markdown": "^4.3.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.183.1",
    "@vitejs/plugin-react": "^4.7.0",
    "typescript": "^5.9.3",
    "vite": "^5.4.21"
  }
}
```

### 2.2 `apps/docs/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: process.env.DOCS_BASE_PATH ?? '/docs/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      {
        find: /^@brewsite\/core\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/core/src/$1'),
      },
      {
        find: /^@brewsite\/diagram\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/diagram/src/$1'),
      },
      {
        find: '@brewsite/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: '@brewsite/diagram',
        replacement: resolve(__dirname, '../../packages/diagram/src/index.ts'),
      },
    ],
  },
  server: {
    host: true,
    port: 5174,
    fs: {
      // Allow serving GLB and motion files from the examples public directory during dev
      allow: ['../../apps/examples/public', '../..'],
    },
  },
  // In dev, Vite serves examples/public assets directly via fs.allow + the
  // /assets URL prefix handled by a small middleware (see Section 2.3b).
  // In production build, copy-demo-assets.mjs copies needed GLBs to public/assets/.
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react-vendor': ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
});
```

### 2.3 `apps/docs/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### 2.4 `apps/docs/.env.template`

Copy to `.env.local` and fill in values to enable optional features.

```ini
# Base path for Vite (override if served under a subdirectory)
# DOCS_BASE_PATH=/docs/

# Google Analytics — leave empty to disable GA entirely
VITE_GA_MEASUREMENT_ID=
```

`.env.local` is gitignored. `.env.template` is checked in and kept in sync with any new env vars added.

### 2.5 `apps/docs/siteResources.ts`

The docs app has its own minimal asset manifest. It declares only the MaleDummy model and two clean looping animations used in model demos. Run `pnpm --filter @brewsite/docs gen:scene-dsl` after changes.

```typescript
// apps/docs/siteResources.ts
export const siteResources = {
  models: [
    {
      type: 'MaleDummy',
      role: 'primary' as const,
      // Path relative to the docs public dir.
      // In dev: served via vite server.fs.allow from apps/examples/public.
      // In build: copy-demo-assets.mjs copies the file to apps/docs/public/assets/.
      path: '/assets/motion-dummy_male.no-normals.glb',
      footOffsetY: 0.06,
      scale: 30,
    },
  ],
  animations: [
    {
      // Relaxed standing idle — loopable, neutral pose. Used as base state.
      type: 'ChatRelaxM',
      path: '/assets/motion/chat-relax-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      // Standing chat — subtle upper-body movement. Used for "active" scene demos.
      type: 'StandingChatM',
      path: '/assets/motion/standing-chat-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
  ],
};
```

After running `gen:scene-dsl`, the following generated files appear in `src/generated/`:
- `sceneDsl.generated.tsx` — root re-export
- `sceneDsl.MaleDummy.generated.tsx` — typed `<MaleDummy>` DSL component with `MaleDummyClipName` type

These generated files are gitignored (add `src/generated/` to `.gitignore`). They are always regenerated before build.

### 2.6 `apps/docs/scripts/copy-demo-assets.mjs`

Run during production build to copy GLB files from the examples app's public directory into the docs public directory.

```javascript
// apps/docs/scripts/copy-demo-assets.mjs
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesPublic = resolve(__dirname, '../../../apps/examples/public');
const docsPublic = resolve(__dirname, '../public');

const ASSETS = [
  'assets/motion-dummy_male.no-normals.glb',
  'assets/motion/chat-relax-m.glb',
  'assets/motion/standing-chat-m.glb',
];

for (const asset of ASSETS) {
  const src = resolve(examplesPublic, asset);
  const dst = resolve(docsPublic, asset);
  if (!existsSync(src)) {
    console.warn(`[copy-demo-assets] Missing source: ${src}`);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  console.log(`[copy-demo-assets] Copied: ${asset}`);
}
```

Add to `package.json` scripts:

```json
"prebuild": "node scripts/copy-demo-assets.mjs && pnpm gen:scene-dsl"
```

### 2.7 `apps/docs/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BrewSite Docs</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 3. `src/` Directory Structure

```
apps/docs/src/
├── main.tsx
├── App.tsx
├── routes.tsx
├── style/
│   ├── global.css
│   ├── variables.css
│   ├── layout.css
│   └── prism-theme.css
├── components/
│   ├── layout/
│   │   ├── DocLayout.tsx
│   │   ├── DocSidebar.tsx
│   │   ├── DocContent.tsx
│   │   └── DocHeader.tsx
│   ├── demo/
│   │   ├── LiveDemo.tsx
│   │   ├── DemoControls.tsx
│   │   └── DemoShell.tsx
│   └── ui/
│       ├── CodeBlock.tsx
│       ├── PropTable.tsx
│       ├── Callout.tsx
│       ├── CopyButton.tsx
│       └── ApiSection.tsx
├── nav/
│   ├── types.ts
│   ├── core-nav.ts
│   └── diagram-nav.ts
├── pages/
│   ├── core/
│   │   ├── getting-started/
│   │   ├── scene-authoring/
│   │   ├── elements/
│   │   ├── hud/
│   │   ├── labels/
│   │   ├── input/
│   │   ├── player/
│   │   ├── widget-sdk/
│   │   └── reference/
│   └── diagram/      (see plan_docs_diagram.md)
└── demos/
    ├── shared/
    │   ├── demoSetup.ts
    │   └── DemoScene.tsx
    └── core/
        └── (individual demo files — see Section 8)
```

---

## 4. Entry Points

### 3.1 `apps/docs/index.html` (final)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BrewSite Docs</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- Theme bootstrap: applies .theme-light before React mounts to prevent flash -->
    <script>
      (function() {
        var saved = localStorage.getItem('brewsite-docs-theme');
        if (saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches)) {
          document.documentElement.classList.add('theme-light');
        }
      })();
    </script>
    <!-- Google Analytics: only injected when VITE_GA_MEASUREMENT_ID is set at build time -->
    %VITE_GA_SCRIPT%
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

The `%VITE_GA_SCRIPT%` placeholder is replaced by a Vite plugin (see Section 4.3) only when `VITE_GA_MEASUREMENT_ID` is non-empty in the environment. When empty, the placeholder is removed.

---

## 4. Entry Points

### 4.1 `src/main.tsx`

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './style/global.css';
import './style/variables.css';

const root = document.getElementById('root')!;
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

### 4.2 `src/App.tsx`

```tsx
import { JSX } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { DocLayout } from './components/layout/DocLayout';
import { coreNav } from './nav/core-nav';
import { diagramNav } from './nav/diagram-nav';

// Core pages (lazy-loaded per section)
import { lazy, Suspense } from 'react';

const GettingStarted = lazy(() => import('./pages/core/getting-started/GettingStarted'));
const Installation    = lazy(() => import('./pages/core/getting-started/Installation'));
const QuickStart      = lazy(() => import('./pages/core/getting-started/QuickStart'));
const CoreConcepts    = lazy(() => import('./pages/core/getting-started/CoreConcepts'));
// ... (all other pages — see Section 7 for the full list)

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/core/getting-started" replace />} />
      <Route path="/core/*" element={<DocLayout book="core" nav={coreNav} />}>
        <Route path="getting-started" element={<Suspense fallback={null}><GettingStarted /></Suspense>} />
        <Route path="installation"    element={<Suspense fallback={null}><Installation /></Suspense>} />
        <Route path="quick-start"     element={<Suspense fallback={null}><QuickStart /></Suspense>} />
        {/* ... all core routes */}
      </Route>
      <Route path="/diagram/*" element={<DocLayout book="diagram" nav={diagramNav} />}>
        {/* see plan_docs_diagram.md */}
      </Route>
    </Routes>
  );
}
```

### 4.3 Google Analytics Vite Plugin (`vite.config.ts` addition)

Add a small inline Vite plugin that injects the GA script only when `VITE_GA_MEASUREMENT_ID` is set:

```typescript
// In vite.config.ts, add to plugins array:
{
  name: 'inject-ga',
  transformIndexHtml(html) {
    const gaId = process.env.VITE_GA_MEASUREMENT_ID;
    const script = gaId
      ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
         <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>`
      : '';
    return html.replace('%VITE_GA_SCRIPT%', script);
  },
},
```

When `VITE_GA_MEASUREMENT_ID` is empty or unset, the GA scripts are completely absent from the HTML output — no empty tags, no tracking.

### 4.4 `src/components/ui/ThemeToggle.tsx`

Renders a sun/moon toggle button. Writes `theme-light` class to `<html>` and persists to `localStorage`.

```tsx
import React, { useState, useEffect, JSX } from 'react';

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('brewsite-docs-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('brewsite-docs-theme', theme);
  }, [theme]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
```

Add `ThemeToggle` to `DocHeader` next to the GitHub link.

---

## 5. CSS Design System

### 5.1 `src/style/variables.css`

The site supports light and dark mode. Dark mode is the default; light mode is applied via `.theme-light` on `<html>`. The `ThemeToggle` component (Section 6.5) writes this class and persists the preference in `localStorage`. On first load, the system preference (`prefers-color-scheme`) is read.

```css
/* ─── Dark theme (default) ─────────────────────────────────── */
:root {
  /* Backgrounds */
  --bg-page:      #0d0d12;
  --bg-sidebar:   #111117;
  --bg-surface:   #17171f;
  --bg-elevated:  #1e1e28;
  --bg-code:      #12121a;
  --bg-demo:      #0a0a10;

  /* Borders */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.18);

  /* Text */
  --text-primary:   #e4e4f0;
  --text-secondary: #8888aa;
  --text-muted:     #55556a;
  --text-code:      #c0c0e0;
  --text-link:      #5b9fff;

  /* Accent */
  --accent-blue:    #4d9fff;
  --accent-purple:  #8b5cf6;
  --accent-green:   #34d399;
  --accent-orange:  #f97316;   /* BrewSite brand orange */
  --accent-orange-light: #fb923c;
  --accent-red:     #f87171;

  /* Brand — BrewSite dark-orange-to-lighter-orange gradient */
  --brand-gradient: linear-gradient(135deg, #c2410c 0%, #f97316 50%, #fb923c 100%);

  /* Layout */
  --sidebar-width:        260px;
  --header-height:        56px;
  --content-max-width:    820px;
  --demo-height:          420px;
  --demo-height-tall:     560px;

  /* Typography */
  --font-sans:   -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono:   'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace;
  --font-size-xs:   11px;
  --font-size-sm:   13px;
  --font-size-base: 15px;
  --font-size-lg:   17px;
  --font-size-xl:   20px;
  --font-size-2xl:  26px;
  --font-size-3xl:  34px;

  /* Radius */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;

  /* Shadows */
  --shadow-demo: 0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle);
}

/* ─── Light theme override ──────────────────────────────────── */
html.theme-light {
  --bg-page:      #f8f8fc;
  --bg-sidebar:   #f0f0f8;
  --bg-surface:   #ffffff;
  --bg-elevated:  #f4f4fb;
  --bg-code:      #f0f0f8;
  --bg-demo:      #e8e8f4;

  --border-subtle:  rgba(0,0,0,0.06);
  --border-default: rgba(0,0,0,0.10);
  --border-strong:  rgba(0,0,0,0.18);

  --text-primary:   #111118;
  --text-secondary: #444460;
  --text-muted:     #888899;
  --text-code:      #333344;
  --text-link:      #1a6fd4;

  --shadow-demo: 0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px var(--border-subtle);
}

/* ─── System preference bootstrap (applied before React mounts) ─ */
/* Inline script in index.html sets theme-light class if system prefers light
   AND no localStorage preference is set. See Section 4.1 for the script. */
```

### 5.2 `src/style/global.css`

```css
@import './variables.css';

*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

h1 { font-size: var(--font-size-3xl); font-weight: 700; margin: 0 0 0.5rem; line-height: 1.2; }
h2 { font-size: var(--font-size-2xl); font-weight: 600; margin: 2.5rem 0 0.75rem; line-height: 1.3; }
h3 { font-size: var(--font-size-xl);  font-weight: 600; margin: 2rem 0 0.5rem; }
h4 { font-size: var(--font-size-lg);  font-weight: 600; margin: 1.5rem 0 0.5rem; }

p  { margin: 0 0 1rem; color: var(--text-secondary); }
a  { color: var(--text-link); text-decoration: none; }
a:hover { text-decoration: underline; }

code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.15em 0.35em;
  color: var(--text-code);
}

pre code { background: none; border: none; padding: 0; }
```

### 5.3 `src/style/layout.css`

```css
.doc-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
  min-height: 100vh;
}

.doc-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 24px;
}

.doc-sidebar {
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-sidebar);
  overflow-y: auto;
  position: sticky;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  padding: 16px 0;
}

.doc-content {
  padding: 48px 48px 96px;
  max-width: calc(var(--content-max-width) + 96px);
  overflow-x: hidden;
}

/* Demo pane */
.live-demo {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin: 28px 0;
  box-shadow: var(--shadow-demo);
}

.live-demo__scene {
  height: var(--demo-height);
  background: var(--bg-demo);
  position: relative;
}

.live-demo__scene--tall {
  height: var(--demo-height-tall);
}

.live-demo__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
}

.live-demo__code {
  border-top: 1px solid var(--border-subtle);
  max-height: 360px;
  overflow: auto;
}

/* Code block */
.code-block {
  position: relative;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin: 16px 0;
  overflow: hidden;
}

.code-block__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.code-block__lang {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.code-block pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}

/* PropTable */
.prop-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: var(--font-size-sm);
}

.prop-table th {
  text-align: left;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.prop-table td {
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  vertical-align: top;
}

.prop-table td:first-child {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--accent-blue);
  white-space: nowrap;
}

.prop-table tr:nth-child(even) td { background: var(--bg-surface); }

/* Callout */
.callout {
  border-radius: var(--radius-md);
  padding: 14px 18px;
  margin: 20px 0;
  border-left: 3px solid;
  display: flex;
  gap: 12px;
}

.callout--note    { border-color: var(--accent-blue);   background: rgba(77,159,255,0.06); }
.callout--warning { border-color: var(--accent-orange); background: rgba(251,146,60,0.06);  }
.callout--tip     { border-color: var(--accent-green);  background: rgba(52,211,153,0.06);  }

/* Nav */
.nav-section { margin: 4px 0 12px; }
.nav-section__title {
  padding: 4px 20px 4px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.nav-item {
  display: block;
  padding: 5px 20px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border-radius: 0;
  border-left: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  cursor: pointer;
}

.nav-item:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }
.nav-item--active {
  color: var(--accent-blue);
  border-left-color: var(--accent-blue);
  background: rgba(77,159,255,0.07);
}
```

### 5.4 `src/style/prism-theme.css`

Custom Prism.js theme tokens for `prism-react-renderer` using the Dracula-inspired palette:

```css
/* prism-react-renderer tokens via className */
.token.keyword      { color: #ff79c6; }
.token.string       { color: #f1fa8c; }
.token.number       { color: #bd93f9; }
.token.boolean      { color: #bd93f9; }
.token.comment      { color: #6272a4; font-style: italic; }
.token.function     { color: #50fa7b; }
.token.class-name   { color: #8be9fd; }
.token.operator     { color: #ff79c6; }
.token.punctuation  { color: #f8f8f2; }
.token.tag          { color: #ff79c6; }
.token.attr-name    { color: #50fa7b; }
.token.attr-value   { color: #f1fa8c; }
.token.variable     { color: #f8f8f2; }
.token.type-args    { color: #8be9fd; }
```

---

## 6. Shared Layout Components

### 6.1 `src/components/layout/DocLayout.tsx`

```tsx
import { JSX } from 'react';
import { Outlet } from 'react-router';
import { DocHeader } from './DocHeader';
import { DocSidebar } from './DocSidebar';
import type { NavSection } from '../../nav/types';

interface DocLayoutProps {
  book: 'core' | 'diagram';
  nav: NavSection[];
}

export function DocLayout({ book, nav }: DocLayoutProps): JSX.Element {
  return (
    <div className="doc-layout">
      <DocHeader book={book} />
      <DocSidebar nav={nav} />
      <main className="doc-content">
        <Outlet />
      </main>
    </div>
  );
}
```

### 6.2 `src/components/layout/DocHeader.tsx`

```tsx
import { JSX } from 'react';
import { NavLink } from 'react-router';

interface DocHeaderProps {
  book: 'core' | 'diagram';
}

export function DocHeader({ book }: DocHeaderProps): JSX.Element {
  return (
    <header className="doc-header">
      <span className="doc-header__logo">
        <strong>BrewSite</strong> Docs
      </span>
      <nav style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
        <NavLink to="/core/getting-started"
          className={({ isActive }) =>
            `nav-book-tab ${book === 'core' ? 'nav-book-tab--active' : ''}`}>
          @brewsite/core
        </NavLink>
        <NavLink to="/diagram/getting-started"
          className={() =>
            `nav-book-tab ${book === 'diagram' ? 'nav-book-tab--active' : ''}`}>
          @brewsite/diagram
        </NavLink>
      </nav>
      <a
        href="https://github.com/your-org/brewsite"
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 13 }}>
        GitHub
      </a>
    </header>
  );
}
```

### 6.3 `src/components/layout/DocSidebar.tsx`

```tsx
import { JSX } from 'react';
import { NavLink } from 'react-router';
import type { NavSection } from '../../nav/types';

interface DocSidebarProps {
  nav: NavSection[];
}

export function DocSidebar({ nav }: DocSidebarProps): JSX.Element {
  return (
    <aside className="doc-sidebar">
      {nav.map((section) => (
        <div key={section.title} className="nav-section">
          <div className="nav-section__title">{section.title}</div>
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

### 6.4 `src/nav/types.ts`

```typescript
export interface NavItem {
  label: string;
  path: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
```

### 6.5 `src/nav/core-nav.ts`

```typescript
import type { NavSection } from './types';

export const coreNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'What is BrewSite Core?', path: '/core/getting-started' },
      { label: 'Installation',           path: '/core/installation' },
      { label: 'Quick Start',            path: '/core/quick-start' },
      { label: 'Core Concepts',          path: '/core/concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    items: [
      { label: 'Scene DSL',              path: '/core/scene-dsl' },
      { label: 'Multi-Scene Sequences',  path: '/core/multi-scene' },
      { label: 'Transitions & Easing',   path: '/core/transitions' },
    ],
  },
  {
    title: 'Elements',
    items: [
      { label: 'Model',                  path: '/core/model' },
      { label: 'Camera',                 path: '/core/camera' },
      { label: 'Lighting',               path: '/core/lighting' },
      { label: 'Background',             path: '/core/background' },
      { label: 'Environment',            path: '/core/environment' },
      { label: 'Floor',                  path: '/core/floor' },
    ],
  },
  {
    title: 'HUD System',
    items: [
      { label: 'HUD Overlay',            path: '/core/hud' },
      { label: 'Anime.js Presets',       path: '/core/hud-animejs' },
    ],
  },
  {
    title: 'Labels',
    items: [
      { label: 'Label System',           path: '/core/labels' },
    ],
  },
  {
    title: 'Input',
    items: [
      { label: 'Scene Navigation',       path: '/core/input-navigation' },
      { label: 'Input Actions',          path: '/core/input-actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    items: [
      { label: 'ScenePlayer',            path: '/core/player' },
      { label: 'Hooks Reference',        path: '/core/hooks' },
    ],
  },
  {
    title: 'Widget SDK',
    items: [
      { label: 'Overview',               path: '/core/widget-sdk' },
      { label: 'Custom Widget',          path: '/core/custom-widget' },
      { label: 'VariableStore',          path: '/core/variable-store' },
      { label: 'Widget Registry',        path: '/core/widget-registry' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'API Reference',          path: '/core/api-reference' },
      { label: 'Timeline & Math',        path: '/core/timeline' },
    ],
  },
];
```

---

## 7. Shared Demo Infrastructure

### 7.1 `src/demos/shared/demoSetup.ts`

Two setup functions: one for non-model demos (no manifest), one for model demos that fetches the manifest and creates a registry with `MaleDummy` registered. The manifest is generated by `gen:scene-dsl` from `siteResources.ts` and served from `public/scene-manifest.json`.

```typescript
import { createDefaultWidgetRegistry, WidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';

/** For demos that don't use model assets (camera, lighting, background, HUD, etc.) */
export function createDemoRegistry(): WidgetRegistry {
  return createDefaultWidgetRegistry(null);
}

/**
 * For demos that use the MaleDummy model.
 * Fetches scene-manifest.json (generated by gen:scene-dsl from siteResources.ts)
 * and creates a registry with MaleDummy registered.
 * Returns a promise — call in useEffect or use the useDemoModelRegistry hook.
 */
export async function createModelDemoRegistry(): Promise<WidgetRegistry> {
  const res = await fetch('/scene-manifest.json');
  if (!res.ok) throw new Error(`Failed to load scene manifest: ${res.status}`);
  const manifest: AssetManifest = await res.json();
  return createDefaultWidgetRegistry(manifest);
}

/**
 * React hook wrapper for createModelDemoRegistry.
 * Returns null while loading, the registry once ready.
 */
export function useModelDemoRegistry(): WidgetRegistry | null {
  const [registry, setRegistry] = useState<WidgetRegistry | null>(null);
  useEffect(() => {
    createModelDemoRegistry().then(setRegistry).catch(console.error);
  }, []);
  return registry;
}
```

### 7.2 `src/demos/shared/DemoScene.tsx`

The `DemoScene` wrapper renders a ScenePlayer with controllable progress, prev/next buttons, and a manual auto-play toggle. **Demos auto-play when they scroll into the viewport** via `IntersectionObserver`. Auto-play is suppressed when the user's system has `prefers-reduced-motion: reduce` set.

```tsx
import React, { useState, useCallback, useEffect, useRef, JSX } from 'react';
import { ScenePlayer, WidgetRegistry } from '@brewsite/core';

// Respect prefers-reduced-motion globally
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface DemoSceneProps {
  /** JSX scene children */
  children: React.ReactNode;
  registry: WidgetRegistry;
  /** Number of scenes in the demo (for progress snapping) */
  sceneCount: number;
  /** Height override in px (default 420) */
  height?: number;
  /** Duration per scene in ms when auto-playing (default 2500) */
  sceneDuration?: number;
}

export function DemoScene({
  children,
  registry,
  sceneCount,
  height = 420,
  sceneDuration = 2500,
}: DemoSceneProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const totalDuration = sceneDuration * sceneCount;

  // Auto-play on scroll into view — off when prefers-reduced-motion
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          startTimeRef.current = 0; // reset loop on re-entry
        } else {
          setPlaying(false);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    if (!playing) {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      return;
    }
    const step = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = (ts - startTimeRef.current) % totalDuration;
      setProgress(elapsed / totalDuration);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [playing, totalDuration]);

  const advance = useCallback(() => {
    setPlaying(false);
    setProgress((p) => {
      const step = 1 / sceneCount;
      return Math.min(1, Math.round((p + step) / step) * step);
    });
  }, [sceneCount]);

  const retreat = useCallback(() => {
    setPlaying(false);
    setProgress((p) => {
      const step = 1 / sceneCount;
      return Math.max(0, Math.round((p - step) / step) * step);
    });
  }, [sceneCount]);

  const currentScene = Math.min(sceneCount, Math.floor(progress * sceneCount) + 1);

  return (
    <div className="demo-scene" ref={containerRef} style={{ height }}>
      <ScenePlayer
        widgetRegistry={registry}
        progress={progress}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </ScenePlayer>
      <div className="demo-scene__controls">
        <button className="demo-btn" onClick={retreat} disabled={progress === 0}>◀</button>
        <button className="demo-btn" onClick={advance} disabled={progress >= 1 - 1 / sceneCount / 10}>▶</button>
        <button
          className={`demo-btn ${playing ? 'demo-btn--active' : ''}`}
          onClick={() => { startTimeRef.current = 0; setPlaying(p => !p); }}
          title={playing ? 'Pause' : 'Auto-play'}
        >
          {playing ? '⏸' : '▶▶'}
        </button>
        <div className="demo-progress">
          <input
            type="range" min={0} max={1} step={0.001}
            value={progress}
            onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value)); }}
            style={{ flex: 1 }}
          />
        </div>
        <span className="demo-scene-label">
          {currentScene} / {sceneCount}
        </span>
      </div>
    </div>
  );
}
```

CSS for `DemoScene` goes in `layout.css`:

```css
.demo-scene {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-demo);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-demo);
}

.demo-scene > div:first-child { /* ScenePlayer container */
  flex: 1;
  min-height: 0;
}

.demo-scene__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.demo-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s;
}
.demo-btn:hover  { background: var(--bg-elevated); }
.demo-btn--active { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; }
.demo-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.demo-progress { display: flex; flex: 1; align-items: center; gap: 8px; }
.demo-scene-label { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
```

### 7.3 `src/components/demo/LiveDemo.tsx`

The `LiveDemo` component combines a `DemoScene` with a toggleable `CodeBlock`. Pages compose this for each demo.

```tsx
import React, { useState, JSX } from 'react';
import { CodeBlock } from '../ui/CodeBlock';

interface LiveDemoProps {
  /** Title shown above the demo */
  title?: string;
  /** The demo component (should render a DemoScene internally) */
  children: React.ReactNode;
  /** TSX source code string shown in the collapsible code panel */
  code: string;
  /** Whether code panel starts open */
  defaultCodeOpen?: boolean;
}

export function LiveDemo({ title, children, code, defaultCodeOpen = false }: LiveDemoProps): JSX.Element {
  const [codeOpen, setCodeOpen] = useState(defaultCodeOpen);

  return (
    <div className="live-demo">
      {title && (
        <div className="live-demo__header">
          <span className="live-demo__title">{title}</span>
          <button
            className="live-demo__code-toggle"
            onClick={() => setCodeOpen((o) => !o)}
          >
            {codeOpen ? 'Hide Code' : 'View Code'}
          </button>
        </div>
      )}
      <div className="live-demo__scene">
        {children}
      </div>
      {codeOpen && (
        <div className="live-demo__code">
          <CodeBlock code={code} language="tsx" />
        </div>
      )}
    </div>
  );
}
```

### 7.4 `src/components/ui/CodeBlock.tsx`

```tsx
import React, { JSX } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  code: string;
  language: 'tsx' | 'typescript' | 'bash' | 'json';
}

export function CodeBlock({ code, language }: CodeBlockProps): JSX.Element {
  return (
    <div className="code-block">
      <div className="code-block__toolbar">
        <span className="code-block__lang">{language}</span>
        <CopyButton text={code} />
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className} style={{ ...style, margin: 0, padding: '20px', fontSize: 13, lineHeight: 1.6 }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
```

### 7.5 `src/components/ui/CopyButton.tsx`

```tsx
import React, { useState, JSX } from 'react';

export function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className="copy-btn" onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}
```

### 7.6 `src/components/ui/PropTable.tsx`

```tsx
import React, { JSX } from 'react';

export interface PropRow {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description: string;
}

export function PropTable({ rows }: { rows: PropRow[] }): JSX.Element {
  return (
    <table className="prop-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              {row.name}
              {row.required && <span style={{ color: 'var(--accent-orange)', marginLeft: 4 }}>*</span>}
            </td>
            <td><code>{row.type}</code></td>
            <td>{row.defaultValue ? <code>{row.defaultValue}</code> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 7.7 `src/components/ui/Callout.tsx`

```tsx
import React, { JSX } from 'react';

interface CalloutProps {
  type: 'note' | 'warning' | 'tip';
  children: React.ReactNode;
}

const icons = { note: 'ℹ️', warning: '⚠️', tip: '💡' };

export function Callout({ type, children }: CalloutProps): JSX.Element {
  return (
    <div className={`callout callout--${type}`}>
      <span>{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}
```

---

## 8. Demo Files — `src/demos/core/`

Each demo file is a self-contained React component. Demos use only `@brewsite/core` (no GLB model files). Backgrounds, cameras, lighting, floors, and environments are sufficient to illustrate most core concepts visually.

### Demo conventions:
- Each file exports one `default` React component (the demo)
- Each file also exports a `CODE` string constant containing the displayable code snippet
- Demos target 2–4 scenes maximum for clarity
- All demos use `DemoScene` from `demos/shared/DemoScene.tsx`

---

### 8.1 `BasicSceneDemo.demo.tsx`

Shows a minimal single-scene setup: background, camera, floor.

```tsx
import React, { JSX } from 'react';
import { Scene, Camera, Background, Floor, Lighting } from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';
import { createDemoRegistry } from '../shared/demoSetup';

const registry = createDemoRegistry();

export const CODE = `
<ScenePlayer widgetRegistry={registry} progress={progress}>
  <Scene key="intro">
    <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
    <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }}
              directional={{ color: '#ffffff', intensity: 1.0, position: [5, 10, 5] }} />
    <Background color="#111122" />
    <Floor opacity={0.6} blur={0.5} />
  </Scene>
</ScenePlayer>
`.trim();

export default function BasicSceneDemo(): JSX.Element {
  return (
    <DemoScene registry={registry} sceneCount={1} height={360}>
      <Scene key="intro">
        <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
        <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }}
                  directional={{ color: '#ffffff', intensity: 1.0, position: [5, 10, 5] }} />
        <Background color="#111122" />
        <Floor opacity={0.6} blur={0.5} />
      </Scene>
    </DemoScene>
  );
}
```

---

### 8.2 `MultiSceneDemo.demo.tsx`

Shows 3 scenes with background and camera transitioning between scenes. No model required.

```tsx
// 3 scenes: each has a different background color and camera position
// Demonstrates that the ScenePlayer interpolates between scenes automatically
import React, { JSX } from 'react';
import { Scene, Camera, Background, Floor, Lighting } from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';
import { createDemoRegistry } from '../shared/demoSetup';

const registry = createDemoRegistry();

export const CODE = `
// Three scenes — the player interpolates between them
<ScenePlayer widgetRegistry={registry} progress={progress}>
  <Scene key="s1">
    <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
    <Background color="#111122" />
    <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }} />
    <Floor opacity={0.6} />
  </Scene>
  <Scene key="s2">
    <Camera descriptor={{ mode: 'orbit', target: [0, 0, 0], azimuth: 1.0, polar: 1.2, distance: 6 }} />
    <Background color="#1a0a2a" />
    <Lighting ambient={{ color: '#8855ff', intensity: 0.6 }} />
    <Floor opacity={0.4} />
  </Scene>
  <Scene key="s3">
    <Camera descriptor={{ mode: 'world', position: [5, 3, 5], target: [0, 0, 0] }} />
    <Background color="#0a1a2a" />
    <Lighting ambient={{ color: '#4488ff', intensity: 0.5 }} />
    <Floor opacity={0.8} />
  </Scene>
</ScenePlayer>
`.trim();

export default function MultiSceneDemo(): JSX.Element {
  return (
    <DemoScene registry={registry} sceneCount={3} autoPlay={2500}>
      <Scene key="s1">
        <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
        <Background color="#111122" />
        <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }} />
        <Floor opacity={0.6} />
      </Scene>
      <Scene key="s2">
        <Camera descriptor={{ mode: 'orbit', target: [0, 0, 0], azimuth: 1.0, polar: 1.2, distance: 6 }} />
        <Background color="#1a0a2a" />
        <Lighting ambient={{ color: '#8855ff', intensity: 0.6 }} />
        <Floor opacity={0.4} />
      </Scene>
      <Scene key="s3">
        <Camera descriptor={{ mode: 'world', position: [5, 3, 5], target: [0, 0, 0] }} />
        <Background color="#0a1a2a" />
        <Lighting ambient={{ color: '#4488ff', intensity: 0.5 }} />
        <Floor opacity={0.8} />
      </Scene>
    </DemoScene>
  );
}
```

---

### 8.3 `CameraWorldDemo.demo.tsx`

Demonstrates `mode: 'world'` camera transitions across 3 scenes.

### 8.4 `CameraOrbitDemo.demo.tsx`

Demonstrates `mode: 'orbit'` with azimuth/polar/distance changing across 3 scenes. The camera revolves around the origin.

### 8.5 `CameraInteractiveDemo.demo.tsx`

Demonstrates `interaction: { enabled: true, rotate: {...}, zoom: {...}, constraints: {...} }`. Uses `EngineInputRegion`. Note: this demo allows the user to orbit with mouse/trackpad.

```tsx
// This demo wraps the scene in EngineInputRegion and
// sets up camera orbit/dolly/reset via InputController + Action DSL.
```

### 8.6 `TransitionEasingDemo.demo.tsx`

Shows 5 variants of the same 2-scene transition with different easing curves: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeOutElastic`. Each variant is a separate demo tab.

### 8.7 `LightingDemo.demo.tsx`

Shows ambient, directional, and point lighting variants. 3 scenes each with different light types and colors. Demonstrates color/intensity interpolation.

### 8.8 `BackgroundDemo.demo.tsx`

Shows background color transition across 4 scenes. No other elements needed.

### 8.9 `EnvironmentDemo.demo.tsx`

Shows HDR environment map. References the same env map used in `@brewsite/diagram` (accessible at `/assets/envmaps/`). Shows metallic floor reflection with/without the HDR.

### 8.10 `FloorReflectionDemo.demo.tsx`

Shows floor with varying opacity and blur values. 3 scenes: no floor → subtle floor → fully reflective floor.

### 8.11 `HudOverlayDemo.demo.tsx`

Shows `<Hud>` and `<HudItem>` with CSS styling. Demonstrates a text overlay appearing on scene entry. Uses `contentSlots` for a custom React component in the overlay.

### 8.12 `InputScrollDemo.demo.tsx`

Shows the `EngineScrollRegion` setup. This demo needs special handling since it relies on browser scroll — it creates a scroll spacer and shows scroll-progress text updating.

### 8.13 `InputDirectDemo.demo.tsx`

Shows direct mode (no scroll spacer). The demo has a drag/wheel handler on the canvas.

### 8.14 `InputActionsDemo.demo.tsx`

Shows `InputController` with `camera.orbit`, `camera.dolly`, `camera.reset` Actions. The demo canvas responds to orbit drag and wheel dolly.

### 8.15 `VariableStoreDemo.demo.tsx`

Shows `useVariable` hook reading a value published by `SceneMetaWidget`. Displays `scene.id` and `scene.index` as a React overlay that updates as scenes advance.

---

### 8.16 `ModelBasicDemo.demo.tsx`

Shows `MaleDummy` in `ChatRelaxM` animation across 3 scenes — position, rotation, and camera changing per scene. Uses `useModelDemoRegistry()`.

```tsx
import React, { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Floor, Model } from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';
import { useModelDemoRegistry } from '../shared/demoSetup';

export const CODE = `
// Model demo uses the MaleDummy GLTF with ChatRelaxM idle animation.
// Registry is created via createDefaultWidgetRegistry(manifest)
// where manifest comes from your gen:scene-dsl output.

<Scene key="s1">
  <Camera descriptor={{ mode: 'fitBotHeight', targetId: 'character', targetHeight: 1.8, framingHeightPct: 0.85 }} />
  <Model type="MaleDummy" id="character"
    position={[0, 0, 0]}
    rotation={[0, 0, 0]}
    animation={{ clip: 'ChatRelaxM', loop: true }}
  />
  <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }}
            directional={{ color: '#aaddff', intensity: 1.0, position: [5, 10, 5] }} />
  <Background color="#0f0f1a" />
  <Floor opacity={0.5} blur={0.5} />
</Scene>
<Scene key="s2">
  <Camera descriptor={{ mode: 'orbit', target: [0, 0.9, 0], azimuth: 0.8, polar: 1.3, distance: 4 }} />
  <Model type="MaleDummy" id="character"
    position={[0, 0, 0]}
    rotation={[0, 1.2, 0]}
    animation={{ clip: 'ChatRelaxM', loop: true }}
  />
  <Background color="#0d1a2e" />
</Scene>
`.trim();

export default function ModelBasicDemo(): JSX.Element {
  const registry = useModelDemoRegistry();
  if (!registry) return <div className="demo-loading">Loading model…</div>;

  return (
    <DemoScene registry={registry} sceneCount={2} sceneDuration={3000}>
      <Scene key="s1">
        <Camera descriptor={{ mode: 'fitBotHeight', targetId: 'character', targetHeight: 1.8, framingHeightPct: 0.85 }} />
        <Model type="MaleDummy" id="character"
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          animation={{ clip: 'ChatRelaxM', loop: true }}
        />
        <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }}
                  directional={{ color: '#aaddff', intensity: 1.0, position: [5, 10, 5] }} />
        <Background color="#0f0f1a" />
        <Floor opacity={0.5} blur={0.5} />
      </Scene>
      <Scene key="s2">
        <Camera descriptor={{ mode: 'orbit', target: [0, 0.9, 0], azimuth: 0.8, polar: 1.3, distance: 4 }} />
        <Model type="MaleDummy" id="character"
          position={[0, 0, 0]}
          rotation={[0, 1.2, 0]}
          animation={{ clip: 'ChatRelaxM', loop: true }}
        />
        <Background color="#0d1a2e" />
      </Scene>
    </DemoScene>
  );
}
```

---

### 8.17 `ModelAnimationDemo.demo.tsx`

Shows animation clip switching: Scene 1 plays `ChatRelaxM` (relaxed idle), Scene 2 transitions to `StandingChatM` (subtle active movement). Camera stays fixed to show the body clearly.

```tsx
// Key DSL: two scenes with different 'clip' values — the compiler bakes a clip
// crossfade into the SceneTrack. No manual animation mixing code required.

<Scene key="relaxed">
  <Model type="MaleDummy" id="character"
    position={[0, 0, 0]}
    animation={{ clip: 'ChatRelaxM', loop: true }}
  />
</Scene>
<Scene key="active">
  <Model type="MaleDummy" id="character"
    position={[0, 0, 0]}
    animation={{ clip: 'StandingChatM', loop: true }}
  />
</Scene>
```

---

## 9. Doc Pages — Full Content Specification

All pages live in `src/pages/core/`. Each page is a React component that uses `LiveDemo`, `CodeBlock`, `PropTable`, and `Callout` components.

### 9.1 Getting Started — `GettingStarted.tsx`

**Route**: `/core/getting-started`

**Content**:
1. H1: "What is BrewSite Core?"
2. Short pitch paragraph (2 sentences from vision PRD)
3. Feature list (3D scene animation, declarative DSL, pre-baked track, widget SDK, SSR-safe)
4. `LiveDemo` embedding `MultiSceneDemo` — shows a 3-scene sequence with camera and lighting automatically animating. Code panel shows the full setup.
5. "Ready to get started?" → link to Installation

---

### 9.2 Installation — `Installation.tsx`

**Route**: `/core/installation`

**Content**:
1. H1: "Installation"
2. `CodeBlock` with bash: `npm install @brewsite/core three react react-dom`
3. Peer deps table: `three ^0.183.1`, `react ^19.2.4`, `react-dom ^19.2.4`
4. H2: "TypeScript"
5. CodeBlock with `tsconfig.json` setup (strict: true, jsx: react-jsx)
6. H2: "Vite Setup"
7. `CodeBlock` with the vite alias config (so workspace consumers resolve to source)
8. `Callout type="note"`: "If you're not using Vite, import from the `dist/` output directly."
9. H2: "Optional: camera-controls"
10. Explanation that `camera-controls` is required only if `interaction: { enabled: true }` is used on `<Camera>`
11. `CodeBlock`: `npm install camera-controls`

---

### 9.3 Quick Start — `QuickStart.tsx`

**Route**: `/core/quick-start`

**Content**:
This is the most important page. It walks the developer through building a working 2-scene animated sequence from scratch, step by step.

1. H1: "Quick Start"
2. Callout tip: "You'll have a running 3D animation scene in about 15 minutes."

**Step 1: Create the Widget Registry**
```tsx
import { createDefaultWidgetRegistry } from '@brewsite/core';
const registry = createDefaultWidgetRegistry(null); // null = no model assets
```

**Step 2: Author Two Scenes**
Full `<Scene>` JSX with Camera, Lighting, Background, Floor.

**Step 3: Mount ScenePlayer**
Show `<ScenePlayer>` with `widgetRegistry`, `progress` prop.

**Step 4: Add Progress Control**
Show `useState(0)` + arrow buttons.

**Step 5: Final result**
Full component code. `LiveDemo` embedding `MultiSceneDemo` with the final code.

**Next steps section**: links to Scene DSL, Elements, Input Navigation.

---

### 9.4 Core Concepts — `CoreConcepts.tsx`

**Route**: `/core/concepts`

**Content**:
1. H1: "Core Concepts"
2. H2: "Declarative Scene Snapshots"
   - Prose: scenes are pure state declarations, no animation math
   - `CodeBlock` showing a 2-scene sequence side by side
3. H2: "Pre-Baked SceneTrack"
   - Diagram (ASCII or SVG inline): DSL → Compiler → SceneTrack → Runtime → Frame
   - Explanation of O(1) sampling
4. H2: "The Widget System"
   - Prose: every renderable concept is a widget
   - Brief interface hierarchy overview
   - Link to Widget SDK section
5. H2: "Layer Architecture"
   - Table: Player → Runtime → Compiler → Elements → Widget SDK → Timeline/Math
   - Note: Three.js confined to render.ts files
6. H2: "SSR Safety"
   - Bullet list of SSR guarantees

---

### 9.5 Scene DSL — `SceneDsl.tsx`

**Route**: `/core/scene-dsl`

**Content**:
1. H1: "Scene DSL"
2. H2: "`<Scene>` Component"
3. `PropTable` for `SceneProps`:
   - `key` (required, replaces `id` as React key)
   - `id` (optional string, backward compat)
   - `transition` (optional `{ easing?: EasingName }`)
4. `LiveDemo` embedding `BasicSceneDemo`
5. H2: "Scene Identity"
   - Explanation that React `key` is the scene identifier
   - Warning `Callout`: "Always set `key` as a stable string, not an index."
6. H2: "Elements Inside `<Scene>`"
   - `<Camera>`, `<Lighting>`, `<Background>`, `<Floor>`, `<Environment>`, `<Model>`, `<Hud>`, `<InputController>`
   - Each is a link to the relevant doc page
7. H2: "Scene Inheritance"
   - Explain that elements not declared in a scene inherit the previous scene's state

---

### 9.6 Multi-Scene Sequences — `MultiScene.tsx`

**Route**: `/core/multi-scene`

**Content**:
1. H1: "Multi-Scene Sequences"
2. H2: "Ordering Scenes"
3. `LiveDemo` embedding `MultiSceneDemo`
4. H2: "How Progress Works"
   - Progress `[0, 1]` spans all scenes
   - Math: `sceneIndex = Math.floor(progress * sceneCount)`
5. H2: "Scene Count and Frame Resolution"
   - 30 frames per scene, 10× oversampling rate defaults
   - Link to Timeline API reference
6. H2: "Scene Inheritance"
   - Same-element across scenes: only changed props animate; unchanged props stay static

---

### 9.7 Transitions & Easing — `Transitions.tsx`

**Route**: `/core/transitions`

**Content**:
1. H1: "Transitions & Easing"
2. `LiveDemo` embedding `TransitionEasingDemo` with tabs for each easing type
3. H2: "The `transition` prop"
   - `<Scene transition={{ easing: 'easeInOut' }}>`
   - `EasingName` type values: `'linear'`, `'easeIn'`, `'easeOut'`, `'easeInOut'`, `'easeOutElastic'`
4. H2: "How Transitions Are Baked"
   - Prose explaining the pre-bake model
   - Entry vs exit transitions
5. H2: "Writing Custom Transition Specs"
   - `ElementTransitionSpec<TState>` vs `FunctionalTransitionSpec<TState>`
   - Code examples for each
   - Link to Widget SDK for full detail

---

### 9.8 Model Element — `ModelElement.tsx`

**Route**: `/core/model`

**Demo model**: `MaleDummy` (`motion-dummy_male.no-normals.glb`). Uses `useModelDemoRegistry()` from `demoSetup.ts`. Two animations are available for demos: `ChatRelaxM` (relaxed idle standing) and `StandingChatM` (subtle upper-body movement).

The demo component pattern for model pages:
```tsx
import { useModelDemoRegistry } from '../../demos/shared/demoSetup';
import type { MaleDummyClipName } from '../../generated/sceneDsl.generated';
// Note: MaleDummy is the generated typed wrapper; raw <Model type="MaleDummy"> also works.

export default function ModelElementPage(): JSX.Element {
  const registry = useModelDemoRegistry(); // null while loading
  if (!registry) return <div className="demo-loading">Loading model...</div>;
  // ... render demo with live ScenePlayer
}
```

**Content**:
1. H1: "Model Element"
2. Overview: GLTF model loading, animation playback, position/rotation/scale
3. `LiveDemo` embedding `ModelBasicDemo` — shows MaleDummy model in `ChatRelaxM` idle animation, camera orbiting
4. H2: "Asset Manifest"
   - How `gen:scene-dsl` generates the manifest from `siteResources.ts`
   - `siteResources.ts` format with annotated example
   - `CodeBlock` (bash): `pnpm --filter @your-app gen:scene-dsl`
5. H2: "Basic Usage"
   - `CodeBlock` with `<Model type="MaleDummy" id="character" position={[0, 0, 0]} />`
6. H2: "`<Model>` Props"
   - `PropTable` with: type, id, position, rotation, scale, opacity, visible, animation, motionCommands, parts
7. H2: "Animation Clips"
   - `animation` prop: `clip`, `loop`, `timeScale`
   - `LiveDemo` embedding `ModelAnimationDemo` — scene 1: `ChatRelaxM`, scene 2: `StandingChatM`
   - Available `MaleDummyClipName` values shown in a code block
8. H2: "Contained Models"
   - `<ContainedModel>` child, `anchorKey` prop
   - Concept explained; `CodeBlock` showing the DSL pattern
9. H2: "Setting Up the Widget Registry with a Manifest"
   - Full `CodeBlock` showing manifest fetch + `createDefaultWidgetRegistry(manifest)` pattern

---

### 9.9 Camera Element — `CameraElement.tsx`

**Route**: `/core/camera`

**Content**:
1. H1: "Camera Element"
2. Overview prose
3. H2: "World Mode"
   - `LiveDemo` embedding `CameraWorldDemo`
   - `CodeBlock` with `mode: 'world'` example
4. H2: "Orbit Mode"
   - `LiveDemo` embedding `CameraOrbitDemo`
   - `CodeBlock` with `mode: 'orbit'` example
   - Note on azimuth/polar radians
5. H2: "fitBotHeight Mode"
   - Prose explanation (runtime framing, model must be loaded)
   - `CodeBlock` example
6. H2: "fitFloorDepth Mode"
   - `CodeBlock` example
7. H2: "Lens Configuration"
   - `PropTable` for `CameraLens`: fov, focalLength, filmGauge, near, far
8. H2: "Post Processing"
   - `PropTable` for `CameraPost`: exposure
9. H2: "Interactive Camera"
   - `LiveDemo` embedding `CameraInteractiveDemo`
   - `PropTable` for `TrackpadCameraConfig`
   - Note on `camera-controls` peer dep

---

### 9.10 Lighting Element — `LightingElement.tsx`

**Route**: `/core/lighting`

**Content**:
1. H1: "Lighting Element"
2. `LiveDemo` embedding `LightingDemo`
3. H2: "Ambient Light"
4. H2: "Directional Light"
5. H2: "Point Lights"
6. `PropTable` for `LightingDSL` props
7. Note on PBR environment maps (link to Environment page)

---

### 9.11 Background Element — `BackgroundElement.tsx`

**Route**: `/core/background`

**Content**:
1. `LiveDemo` embedding `BackgroundDemo`
2. H2: "Color Backgrounds"
3. H2: "Gradient Backgrounds"
4. `PropTable`

---

### 9.12 Environment Element — `EnvironmentElement.tsx`

**Route**: `/core/environment`

**Content**:
1. `LiveDemo` embedding `EnvironmentDemo`
2. Explanation of HDR env maps
3. Usage with `gen-diagram-envmap`
4. `PropTable`

---

### 9.13 Floor Element — `FloorElement.tsx`

**Route**: `/core/floor`

**Content**:
1. `LiveDemo` embedding `FloorReflectionDemo`
2. `PropTable` for Floor props: opacity, blur, color, size

---

### 9.14 HUD Overlay — `HudOverview.tsx`

**Route**: `/core/hud`

**Content**:
1. H1: "HUD System"
2. Architecture overview: React overlay rendered over the Three.js canvas
3. `LiveDemo` embedding `HudOverlayDemo`
4. H2: "`<Hud>` and `<HudItem>`"
   - Props table
   - `style` prop is `React.CSSProperties`
5. H2: "Content Slots"
   - `contentSlots` prop on `ScenePlayer`
   - Code showing named slot injection
6. H2: "Visibility Baking"
   - `enabled` prop bakes visibility into SceneTrack

---

### 9.15 HUD Anime.js Presets — `HudAnimejs.tsx`

**Route**: `/core/hud-animejs`

**Content**:
1. H1: "HUD Anime.js Presets"
2. Prose on the `hud/animejs/` sub-module
3. Code examples for available presets: fadeIn, slideUp, stagger
4. `Callout type="note"`: "animejs is bundled with @brewsite/core — no additional install needed."

---

### 9.16 Label System — `LabelSystem.tsx`

**Route**: `/core/labels`

**Content**:
1. H1: "3D Label System"
2. Architecture diagram: Three.js bone → LabelPositioner → screen pixel → LabelItem DOM
3. `Callout type="note"`: "Labels require a model with named bones. The demo below shows the integration pattern; the code uses a sample model with named bone targets."
4. H2: "`<Label>` DSL"
   - Must be child of `<Model>`
   - `PropTable` for LabelProps: id, text, labelOffset, enabled, style
5. H2: "`LabelPositioner`"
   - Integration pattern code
6. H2: "`LabelItem`"
   - Direct DOM mutation strategy (why no setState per frame)
7. H2: "`LabelStyle` Reference"
   - PropTable: color, lineColor, fontSize, fontWeight, lineOpacity, labelOpacity, lineThickness, lineLength

---

### 9.17 Input Navigation — `Navigation.tsx`

**Route**: `/core/input-navigation`

**Content**:
1. H1: "Scene Navigation"
2. H2: "Scroll Mode"
   - `LiveDemo` embedding `InputScrollDemo`
   - `EngineScrollRegion` setup code
   - `SceneNavInputMap` props table
3. H2: "Direct Mode"
   - `LiveDemo` embedding `InputDirectDemo`
   - How it differs from scroll mode
4. H2: "Keyboard Navigation"
   - Default key bindings (ArrowRight/Left, Home/End)
   - How to customize
5. H2: "All `SceneNavInputMap` Options"
   - Full PropTable: mode, wheel, drag, swipe, click, keys, pixelsPerScene

---

### 9.18 Input Actions — `Actions.tsx`

**Route**: `/core/input-actions`

**Content**:
1. H1: "Input Actions"
2. Overview: two input subsystems (scene navigation vs action-mapped)
3. `LiveDemo` embedding `InputActionsDemo`
4. H2: "`InputController` and `Action` DSL"
   - PropTable for `InputControllerProps`
   - PropTable for `ActionProps`
5. H2: "`InputActionType` Values"
   - Table: `camera.orbit`, `camera.dolly`, `camera.reset`, `camera.pan`, `canvas.focus`, custom strings
6. H2: "Event Map Types"
   - PropTable for PointerMap, WheelMap, PinchMap, KeyMap
7. H2: "wheelGuard"
   - Explanation of the wheel conflict prevention

---

### 9.19 ScenePlayer Reference — `ScenePlayerRef.tsx`

**Route**: `/core/player`

**Content**:
1. H1: "ScenePlayer"
2. Full `PropTable` for `ScenePlayerProps`:
   - `widgetRegistry` (required)
   - `progress` (required)
   - `children` (required, Scene JSX)
   - `onSceneChange` (optional callback)
   - `contentSlots` (optional Record<string, ReactNode>)
   - `placeholder` (optional ReactNode, shown during load)
   - `onCompileWarning` (optional callback for compile warnings)
3. H2: "EngineFrameDriver"
   - Explanation that ScenePlayer uses EngineFrameDriver internally
   - When to use it directly (advanced custom player)
4. H2: "EngineScrollRegion"
   - Wrapper that provides a scroll spacer
   - `pixelsPerScene` prop
5. H2: "EngineInputRegion"
   - Wrapper that manages `ActionInputController` lifecycle
6. H2: "Asset Loading"
   - `placeholder` prop shown until `assetsReady`
   - Manifest fetch + `createDefaultWidgetRegistry`
7. H2: "TimelineWidget (Debug)"
   - `<TimelineWidget>` overlay component — shows scene timeline, current tick, and progress in the browser
   - Usage: render inside `<ScenePlayer>` as a child (via `contentSlots` named slot or direct child)
   - `PropTable` for `TimelineWidgetProps` and `TimelineTheme`
   - `Callout type="note"`: "TimelineWidget is a development tool — remove it before shipping to production."
   - Code showing conditional dev-only usage:
     ```tsx
     <ScenePlayer widgetRegistry={registry} progress={progress}>
       {scenes}
       {import.meta.env.DEV && <TimelineWidget />}
     </ScenePlayer>
     ```

---

### 9.20 Hooks Reference — `Hooks.tsx`

**Route**: `/core/hooks`

**Content**:
Full reference for all exported hooks. For each hook:
- Signature
- Return type description
- Usage code example
- Must-be-inside-ScenePlayer note where applicable

Hooks covered:
1. `useSceneEngine()` — access RuntimeDriver and EngineState
2. `useEngineScroll()` — scroll-based progress binding
3. `useEngineInput(options)` — inject navigation events
4. `useEngineScrubber()` — direct progress read/write
5. `useSceneProgress()` — [0,1] within current scene
6. `useCurrentScene()` — sceneId + sceneIndex
7. `useSceneRuntime(playerId)` — access SceneRuntimeState from outside player
8. `useEngineState()` — full EngineFrameState
9. `useSceneEngineContext()` — RuntimeDriver from context
10. `useLabelPositioner()` — LabelPositioner instance
11. `useVariable<T>(namespace, key)` — reactive VariableStore value

Also covers the `VariableStoreDemo` for `useVariable`.

---

### 9.21 Widget SDK Overview — `Concepts.tsx`

**Route**: `/core/widget-sdk`

**Content**:
1. H1: "Widget SDK"
2. "Every renderable concept is a widget" philosophy
3. H2: "IWidget Interface Hierarchy"
   - Table of all interfaces: IWidget, ISceneElement, IRenderable, ILoadable, IAnimationController, IContainedModel, IDslComposite, IVariableProvider
   - Columns: Interface, Purpose, Key Methods
4. H2: "Widget Lifecycle"
   - Phase flow: Register → Compile → Initialize → Load → Tick → Apply → Dispose
5. H2: "Type Guards"
   - `isSceneElement`, `isRenderable`, `isLoadable`, etc.

---

### 9.22 Custom Widget — `CustomWidget.tsx`

**Route**: `/core/custom-widget`

**Content**:
This is the most important Widget SDK page — a complete walkthrough of building a custom widget.

1. H1: "Creating a Custom Widget"
2. Callout tip: "Custom widgets are the primary extension point. The toolkit's own elements use the same SDK."
3. Step-by-step walkthrough using `MyElementWidget` as the example (from prd_widget_sdk.md Section 14):
   - **Step 1**: `types.ts` — define state shape
   - **Step 2**: `dsl.tsx` — define DSL component
   - **Step 3**: `compile.ts` — define transition spec
   - **Step 4**: `MyElementWidget.ts` — implement ISceneElement + IRenderable
   - **Step 5**: Register it
   - **Step 6**: Use it in a scene
4. Each step has a full `CodeBlock`
5. H2: "Type-Factory Pattern"
   - Polymorphic widgets via `registerTypeFactory`
   - `<Model type="..." id="...">` example
6. H2: "Contained Model Pattern"
   - `IContainedModel`, `anchorModelId`, `anchorKey`
7. H2: "`CUSTOM_NODE_HANDLER`"
   - When to use (nested DSL like Diagram)
   - Code example

---

### 9.23 VariableStore — `VariableStore.tsx`

**Route**: `/core/variable-store`

**Content**:
1. H1: "VariableStore"
2. `LiveDemo` embedding `VariableStoreDemo`
3. H2: "Writing to the Store"
   - `IAnimationController.onTick` → `variables.set(namespace, key, value)`
4. H2: "Reading in React"
   - `useVariable<T>(namespace, key)` hook
5. H2: "Built-in Namespaces"
   - `scene.id`, `scene.index`, `scene.progress`
6. H2: "VariableStoreReader (read-only)"
   - Available in `IRenderable.apply` via `WidgetRenderContext.variables`

---

### 9.24 Widget Registry — `Registry.tsx`

**Route**: `/core/widget-registry`

**Content**:
1. H1: "WidgetRegistry"
2. H2: "`register(widget)`"
3. H2: "`registerTypeFactory(component, factory)`"
4. H2: "`createDefaultWidgetRegistry(manifest)`"
   - What gets registered (table)
5. H2: "Extending the Default Registry"
   - Code: `createDefaultWidgetRegistry(manifest)` + `registry.register(new MyWidget())`
6. H2: "`strict` Mode"
   - What duplicate widgetId behavior looks like

---

### 9.25 API Reference — `ApiReference.tsx`

**Route**: `/core/api-reference`

**Generation approach**: TypeDoc auto-generates the API reference from `packages/core/src/index.ts` TSDoc comments. The output is rendered as markdown via `typedoc-plugin-markdown` and loaded at build time.

**Build step** (add to `package.json` `prebuild`):
```bash
typedoc --entryPoints ../../packages/core/src/index.ts \
        --out src/generated/api-core \
        --plugin typedoc-plugin-markdown \
        --readme none \
        --excludePrivate --excludeInternal \
        --tsconfig ../../packages/core/tsconfig.json
```

**`ApiReference.tsx`** reads the generated markdown files from `src/generated/api-core/` and renders them via a markdown renderer component. Organized by TypeDoc's module grouping:

- **DSL Components** — `Scene`, `Hud`, `HudItem`, `InputController`, `Action`, `Camera`, `Model`, `Lighting`, `Background`, `Environment`, `Floor`
- **Player** — `ScenePlayer`, `EngineScrollRegion`, `EngineInputRegion`, all hooks
- **Widget SDK** — All `IWidget*` interfaces, `WidgetRegistry`, `VariableStore`, type guards
- **Transitions** — `ElementTransitionSpec`, `FunctionalTransitionSpec`, blend helpers
- **Input** — `SceneNavInputMap`, `InputActionType`, `ActionInputController`
- **Timeline** — `SceneTimeline`, `createSceneTimeline`
- **Math** — `Vec3`, quaternion utilities

The page also links to the TypeDoc full output (as a deployed static site or hosted separately) for deep-dive type navigation.

---

### 9.26 Timeline & Math — `TimelineApi.tsx`

**Route**: `/core/timeline`

**Content**:
1. `SceneTimeline` type reference
2. `createSceneTimeline(scenes, options?)` signature and options
3. `createQualityTimeline(base, subTicksPerSegment)` for oversampling variants
4. Math utilities: Vec3, Mat4, quaternion functions, blend helpers

---

## 10. Build & Static Hosting

### 10.1 Building for GitHub Pages

```bash
DOCS_BASE_PATH=/brewsite/ pnpm --filter @brewsite/docs build
```

Output in `apps/docs/dist/`. Serve statically from any CDN or GitHub Pages.

### 10.2 GitHub Actions (Suggested `.github/workflows/docs.yml`)

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
      - 'packages/core/src/**'
      - 'packages/diagram/src/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: DOCS_BASE_PATH=/brewsite/ pnpm build:docs
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./apps/docs/dist
```

---

## 11. Public Assets

### 11.1 Favicon (`apps/docs/public/favicon.svg`)

The favicon is the BrewSite wordmark rendered as an SVG with the brand gradient (dark orange → lighter orange). The word "B" alone works as a 16px–32px favicon, with the full "BrewSite" wordmark for the 64px+ OG version.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#c2410c"/>
      <stop offset="50%"  stop-color="#f97316"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="url(#g)"/>
  <text x="16" y="23" text-anchor="middle" font-family="system-ui,sans-serif"
        font-weight="800" font-size="18" fill="white">B</text>
</svg>
```

The `DocHeader` logo text uses `var(--brand-gradient)` as a CSS `background-clip: text` gradient for the "BrewSite" wordmark.

### 11.2 Model Assets

Model demos use `motion-dummy_male.no-normals.glb` from `apps/examples/public/assets/`. Assets are served from `apps/examples/public` via `server.fs.allow` in dev. In production, `scripts/copy-demo-assets.mjs` copies the needed files to `apps/docs/public/assets/` before Vite bundles.

Files required (listed in `copy-demo-assets.mjs`):
- `assets/motion-dummy_male.no-normals.glb`
- `assets/motion/chat-relax-m.glb`
- `assets/motion/standing-chat-m.glb`

The scene manifest is generated from `siteResources.ts` via `gen:scene-dsl` and output to `public/scene-manifest.json`.

---

## 12. Testing Strategy

The docs app does not have unit tests (it is a static documentation site). However:

1. **TypeScript compilation** — `pnpm --filter @brewsite/docs typecheck` must pass with zero errors. All demo files must have no TypeScript errors.
2. **Build validation** — `pnpm build:docs` must succeed without warnings. Verifies all demo imports resolve.
3. **Manual demo review** — Each demo component must be visually verified in the browser before merging. A checklist (one row per demo) is maintained in the PR template.
4. **Link checking** — After build, run a link checker against the static output to catch broken internal links.

---

## 13. Implementation Order

Recommended sequence for the implementing engineer:

1. **Phase 1** (Infrastructure): Create `apps/docs/`, package.json, vite.config, tsconfig, index.html, main.tsx, App.tsx, routes (empty), CSS variables, DocLayout, DocSidebar, DocHeader
2. **Phase 2** (Demo Infrastructure): DemoScene, LiveDemo, CodeBlock, CopyButton, PropTable, Callout, `demoSetup.ts`
3. **Phase 3** (Navigation): core-nav.ts, diagram-nav.ts (stub), nav types
4. **Phase 4** (Core Demos): All demo files in `demos/core/` — verify each renders in isolation
5. **Phase 5** (Core Pages — Getting Started): GettingStarted, Installation, QuickStart, CoreConcepts
6. **Phase 6** (Core Pages — Scene Authoring): SceneDsl, MultiScene, Transitions
7. **Phase 7** (Core Pages — Elements): Camera, Lighting, Background, Environment, Floor, Model (code-only)
8. **Phase 8** (Core Pages — HUD, Labels, Input): HudOverview, HudAnimejs, LabelSystem, Navigation, Actions
9. **Phase 9** (Core Pages — Player & Widgets): ScenePlayerRef, Hooks, Widget SDK, CustomWidget, VariableStore, Registry
10. **Phase 10** (Reference): ApiReference, Timeline
11. **Phase 11** (Diagram Book — see `plan_docs_diagram.md`)
12. **Phase 12** (Build & Deploy): GitHub Actions, static hosting verification

---

## 14. Design Decisions and Rationale

- **Light/dark toggle, system-default**: Developers work in both light and dark environments. Defaulting to system preference is the most respectful starting point. Toggle persisted to `localStorage`.
- **No external font CDN**: System fonts only to avoid network dependencies in offline dev.
- **prism-react-renderer over highlight.js**: Lighter, React-native, tree-shakeable.
- **MaleDummy model for model demos**: The `motion-dummy_male.no-normals.glb` is a generic, license-clear model already in the monorepo. `ChatRelaxM` and `StandingChatM` are two clean, neutral, easily loopable animations that illustrate the core concepts without distraction. Only these two clips are included in the docs manifest to keep the asset footprint small.
- **Model assets served from `apps/examples/public` via vite fs.allow in dev**: No asset duplication during development. `copy-demo-assets.mjs` handles the production build copy.
- **Lazy-loaded pages**: Route-level code splitting via `React.lazy` keeps initial bundle under 200KB.
- **No search in v1**: Search adds significant complexity (Algolia paid, or client-side index build). Ship v1 without search; add in v2 after user research.
- **DemoScene with IntersectionObserver auto-play**: Demos start playing when they scroll into view, providing an immediate visual impression with no interaction required. The user can pause, scrub, or step through with controls. Suppressed for `prefers-reduced-motion`.
- **Google Analytics behind `.env`**: GA is a build-time opt-in. Developers building locally never send analytics. Production deployments set `VITE_GA_MEASUREMENT_ID` in their CI environment variables.
- **TypeDoc for API reference**: Keeps the reference in sync with the source automatically. Hand-written prose pages cover concepts and usage; TypeDoc covers the exact type signatures.
- **Base path `/docs/`**: Default deployment path. Override with `DOCS_BASE_PATH` env var for different hosting.
- **BrewSite brand gradient**: Dark orange (`#c2410c`) → orange (`#f97316`) → lighter orange (`#fb923c`). Applied to the logo wordmark and favicon. All other UI uses neutral dark/light backgrounds — the orange is reserved for brand elements only.
