---
title: "Docs — Extract @brewsite/model into its own top-level nav section"
doc_type: plan
owner: Toolkit Product
status: complete
updated: 2026-03-01
---

# Docs — Extract @brewsite/model into its own top-level nav section

## Context

`plan_core_modularization.md` specifies extracting all model- and label-related code from
`@brewsite/core` into a new `@brewsite/model` package. Phase 4 of that plan is the full
code extraction (major version). This docs plan does the **structural nav and routing work
immediately** — ahead of Phase 4 implementation — so the docs site already reflects the
intended architecture. No new documentation content is required yet.

## What moves

From `@brewsite/core` docs to `@brewsite/model` docs:

| Current path | New path | File |
|---|---|---|
| `/core/model` | `/model/model` | `pages/core/ModelElement.tsx` → `pages/model/ModelElement.tsx` |
| `/core/labels` | `/model/labels` | `pages/core/LabelSystem.tsx` → `pages/model/LabelSystem.tsx` |

Also removed from core nav: the entire **Labels** nav section.

## Files to change

### 1. `apps/docs/src/nav/core-nav.ts`

- Remove `{ label: 'Model', path: '/core/model' }` from the **Elements** section.
- Remove the entire **Labels** section:
  ```ts
  // DELETE:
  {
    title: 'Labels',
    items: [{ label: 'Label System', path: '/core/labels' }],
  },
  ```
- The remaining Elements section contains: Camera, Lighting, Background, Environment, Floor.

### 2. `apps/docs/src/nav/model-nav.ts` (NEW FILE)

Create this file modeled after `diagram-nav.ts`:

```ts
import type { NavSection } from './types';

export const modelNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Introduction', path: '/model/introduction' },
    ],
  },
  {
    title: 'Elements',
    items: [
      { label: 'Model Element', path: '/model/model' },
    ],
  },
  {
    title: 'Labels',
    items: [
      { label: 'Label System', path: '/model/labels' },
    ],
  },
];
```

### 3. `apps/docs/src/pages/model/Introduction.tsx` (NEW FILE)

A placeholder page. Match the code style of other docs pages exactly.
Use the same `<section>` wrapper, `<h1>`, and paragraph structure as existing docs pages.

Content:
```tsx
export default function ModelIntroduction(): JSX.Element {
  return (
    <section>
      <h1>@brewsite/model</h1>
      <p>
        <code>@brewsite/model</code> is a separate package that provides GLTF/GLB model
        loading, animation playback, bone-tracked label positioning, and 3D label rendering
        on top of <code>@brewsite/core</code>.
      </p>
      <p>
        Full documentation is coming soon. The <strong>Model Element</strong> and{' '}
        <strong>Label System</strong> pages below contain reference docs that have been
        migrated from the core package.
      </p>
    </section>
  );
}
```

### 4. Move `pages/core/ModelElement.tsx` → `pages/model/ModelElement.tsx`

Move (rename) the file. Do not change the content.

### 5. Move `pages/core/LabelSystem.tsx` → `pages/model/LabelSystem.tsx`

Move (rename) the file. Do not change the content.

### 6. `apps/docs/src/App.tsx`

- Add import: `import { modelNav } from './nav/model-nav';`
- Move lazy imports for `ModelElement` and `LabelSystem` — update their import paths to point to `./pages/model/ModelElement` and `./pages/model/LabelSystem`.
- Add lazy import for `ModelIntroduction`: `const ModelIntroduction = lazy(() => import('./pages/model/Introduction'));`
- Remove from the `/core/*` Route block:
  - `<Route path="model" ...>` (the ModelElement route)
  - `<Route path="labels" ...>` (the LabelSystem route)
- Add a new `/model/*` Route block after the diagram block:
  ```tsx
  {/* Model book */}
  <Route path="/model/*" element={<DocLayout book="model" nav={modelNav} />}>
    <Route path="introduction" element={<Suspense fallback={<Fallback />}><ModelIntroduction /></Suspense>} />
    <Route path="model"        element={<Suspense fallback={<Fallback />}><ModelElement /></Suspense>} />
    <Route path="labels"       element={<Suspense fallback={<Fallback />}><LabelSystem /></Suspense>} />
    <Route index element={<Navigate to="introduction" replace />} />
  </Route>
  ```

### 7. Check `DocLayout` — verify `book="model"` is handled

Read `apps/docs/src/components/layout/DocLayout.tsx`. If the `book` prop is typed as a
string union (e.g. `'core' | 'diagram'`), add `'model'` to it. If it's `string`, no
change needed.

---

## Execution notes

- The pages/model/ directory does not yet exist; the agent must create it by writing files to it.
- The pages/core/ModelElement.tsx and LabelSystem.tsx files should be MOVED (write to new path, then verify old path should be deleted — but since we can't delete, instead update App.tsx to import from the new path; the old files in pages/core/ can remain as dead code for now until a separate cleanup).
- Actually: to avoid dead imports, write copies to pages/model/ and update App.tsx to import from the new paths. The old pages/core/ModelElement.tsx and pages/core/LabelSystem.tsx remain on disk but are no longer imported anywhere.

## Verification

After changes:
1. `/model/introduction` renders the placeholder page
2. `/model/model` renders the Model Element reference
3. `/model/labels` renders the Label System reference
4. Core nav no longer shows Model or Labels
5. `pnpm --filter @brewsite/apps typecheck` passes (no broken imports)
