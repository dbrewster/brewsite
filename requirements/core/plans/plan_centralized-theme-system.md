---
title: "Centralized Theme System"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-13
---

# Centralized Theme System

## Overview

This plan introduces `@brewsite/themes` as a new leaf package, moves all named theme preset data out of the element packages into that single location, and replaces the scattered `theme=` DSL props with a single `theme` prop on `<SceneEngine>`. Theme selection is decoupled from theme registration: `themesPlugin()` registers data, `SceneEngine.theme` selects the active pair.

The plan covers the full scope:
- New `@brewsite/themes` package scaffolding
- `@brewsite/core` changes: `ActiveTheme` type, `ThemeFamily` rename, `SceneSnapshotContext` additions, `sceneThemeRegistry`, `SceneEngine` prop changes, `ThemeKeyContext` removal
- `@brewsite/diagram` changes: `themeRegistry`, removal of `DiagramProps.theme`
- `@brewsite/charts` changes: `chartThemeRegistry`, removal of `BaseChartDSL.theme` and `BaseChartDSL.sceneTheme`
- `SpotlightRig` cleanup
- `apps/examples` migration
- Test strategy
- PRD update requirements

---

## 1. Complete File List

### New files to create

```
packages/themes/                               (new package root)
packages/themes/package.json
packages/themes/tsconfig.json
packages/themes/tsconfig.build.json
packages/themes/src/index.ts
packages/themes/src/types.ts
packages/themes/src/plugin.ts
packages/themes/src/merge.ts
packages/themes/src/activeThemes.ts
packages/themes/src/bundles/index.ts
packages/themes/src/bundles/darkGlass.ts
packages/themes/src/bundles/midnight.ts
packages/themes/src/bundles/neonCyber.ts
packages/themes/src/bundles/lightCanvas.ts
packages/themes/src/bundles/lightMinimal.ts
packages/themes/src/__tests__/plugin.test.ts
packages/themes/src/__tests__/bundles.test.ts
packages/themes/src/__tests__/merge.test.ts

packages/core/src/theme/sceneThemeRegistry.ts  (new file)
```

### Files to modify

```
# @brewsite/core — workspace
packages/core/src/theme/types.ts
packages/core/src/theme/presets.ts
packages/core/src/theme/index.ts
packages/core/src/theme/ThemeKeyContext.ts        (deprecate exports, keep file for now)
packages/core/src/compiler/sceneTypes.ts
packages/core/src/player/SceneEngine.tsx
packages/core/src/player/index.ts
packages/core/src/elements/spotlight-rig/types.ts
packages/core/src/elements/spotlight-rig/compile.ts
packages/core/src/elements/spotlight-rig/index.ts
packages/core/src/elements/spotlight-rig/dsl.tsx  (if SpotlightRigProps.theme exists there)
packages/core/src/elements/spotlight-rig/themes/index.ts
packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts
packages/core/src/theme/__tests__/presets.test.ts

# @brewsite/diagram — workspace
packages/diagram/src/elements/diagram/themes/index.ts
packages/diagram/src/elements/diagram/dsl.tsx
packages/diagram/src/compiler/handlers.ts

# NEW in diagram
packages/diagram/src/elements/diagram/themeRegistry.ts

# @brewsite/charts — workspace
packages/charts/src/themes/index.ts

# NEW in charts
packages/charts/src/themes/chartThemeRegistry.ts

# Root workspace config
pnpm-workspace.yaml                             (already covers packages/*)
turbo.json                                      (add themes to build pipeline if needed)

# apps/examples — all widgetSetup files and many scene files
apps/examples/src/architecture/widgetSetup.ts
apps/examples/src/architecture/ArchitecturePage.tsx
apps/examples/src/architecture/scenes/scene_core.tsx
apps/examples/src/architecture/scenes/scene_diagram.tsx
apps/examples/src/architecture/scenes/scene_model.tsx
apps/examples/src/architecture/scenes/scene_charts.tsx
apps/examples/src/brewflow-comparison/widgetSetup.ts
apps/examples/src/brewflow-comparison/ComparisonPage.tsx
apps/examples/src/brewflow-comparison/scenes/scene_bf_overview.tsx
apps/examples/src/brewflow-comparison/scenes/scene_cf_overview.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim1_audit.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim2_learning.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim3_context.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim4_coordination.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim5_restart.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim6_gating.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim7_safety.tsx
apps/examples/src/brewflow-comparison/scenes/scene_dim8_maturity.tsx
apps/examples/src/brewflow-memory/widgetSetup.ts
apps/examples/src/brewflow-memory/MemorySubsystemPage.tsx
apps/examples/src/brewflow-memory/scenes/*.tsx  (all 7 files)
apps/examples/src/brewflow-multiuser/widgetSetup.ts
apps/examples/src/brewflow-multiuser/MultiUserPage.tsx
apps/examples/src/brewflow-multiuser/scenes/*.tsx  (all 11 files)
apps/examples/src/brewflow-sidecar/widgetSetup.ts
apps/examples/src/brewflow-sidecar/SidecarNotePage.tsx
apps/examples/src/brewflow-sidecar/scenes/*.tsx  (all 12 files)
apps/examples/src/chart/widgetSetup.ts
apps/examples/src/chart/ChartDemoPage.tsx
apps/examples/src/chart/scenes/sceneShared.tsx
apps/examples/src/chart/scenes/*.tsx           (all chart scene files with theme= props)
apps/examples/src/core-showcase/widgetSetup.ts
apps/examples/src/core-showcase/CoreShowcasePage.tsx
apps/examples/src/whiteboard-arch/widgetSetup.ts
apps/examples/src/whiteboard-arch/WhiteboardArchPage.tsx
apps/examples/src/whiteboard-arch/scenes/*.tsx
```

### Files to delete

```
packages/core/src/elements/spotlight-rig/themes/enterprise.ts
packages/core/src/elements/spotlight-rig/themes/darkGlass.ts
packages/core/src/elements/spotlight-rig/themes/neonCyber.ts
packages/core/src/elements/spotlight-rig/themes/lightMinimal.ts
```

The `moviePremiere.ts` and `concertStage.ts` files stay — they are renamed exports.

---

## 2. `packages/themes` Package Setup

### `packages/themes/package.json`

```json
{
  "name": "@brewsite/themes",
  "version": "0.5.1",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@brewsite/core": "workspace:*",
    "@brewsite/diagram": "workspace:*",
    "@brewsite/charts": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/three": "^0.183.1",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.9.3",
    "vitest": "^2.1.9"
  }
}
```

Key notes:
- `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts` are `dependencies` (not peerDependencies) — themes imports concrete theme objects from them at registration time.
- `sideEffects: false` enables tree-shaking of unused bundle files.
- No React peer dep — `@brewsite/themes` has no React components.

### `packages/themes/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/core" },
    { "path": "../../packages/diagram" },
    { "path": "../../packages/charts" }
  ]
}
```

### `packages/themes/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/__tests__/**"]
}
```

### `pnpm-workspace.yaml` — no change needed

The existing `packages/*` glob already covers `packages/themes`. No edit required.

### `turbo.json` — no change needed

The `build:lib`, `typecheck`, `test`, and `coverage` tasks inherit from the workspace root config via `^build` dependency chains. `packages/themes` is automatically included.

---

## 3. Implementation Order

The steps below must be executed in order. Each step is complete and independently compilable before the next begins.

### Step 1 — `@brewsite/core`: Update `ThemeFamily` and `ActiveTheme`

**File: `packages/core/src/theme/types.ts`**

1. Replace `ThemeFamily`:
   - Remove `'enterprise'`
   - Add `'default'`

2. Add `ActiveTheme` interface:

```typescript
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: 'dark' | 'light';
}
```

3. The existing `ThemePolarity` type alias stays as-is (used elsewhere).

Full new `ThemeFamily` definition:
```typescript
export type ThemeFamily =
  | 'default'
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'lightCanvas'
  | 'lightMinimal';
```

4. Remove `SceneThemePair` export from `types.ts`. Move it into `sceneThemeRegistry.ts` as an internal type (see Step 2).

### Step 2 — `@brewsite/core`: Create `sceneThemeRegistry.ts`

**New file: `packages/core/src/theme/sceneThemeRegistry.ts`**

```typescript
// Internal registry for SceneTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init; other families are
// registered by @brewsite/themes at app startup.

import type { SceneTheme } from './types';
import type { ThemeFamily } from './types';
import { enterpriseSceneTheme, enterpriseLightSceneTheme } from './presets';

type SceneThemePair = { dark: SceneTheme; light: SceneTheme };

const registry = new Map<ThemeFamily, SceneThemePair>();

// Pre-load 'default' using the enterprise aesthetic (no external dependency).
registry.set('default', {
  dark: enterpriseSceneTheme,
  light: enterpriseLightSceneTheme,
});

export function registerSceneThemePair(
  family: ThemeFamily,
  pair: SceneThemePair,
): void {
  registry.set(family, pair);
}

export function resolveSceneTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): SceneTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}
```

### Step 3 — `@brewsite/core`: Update `presets.ts`

**File: `packages/core/src/theme/presets.ts`**

The `SCENE_THEME_PAIRS` export keyed by `ThemeFamily` must be updated:
- Remove the `enterprise` entry.
- Add a `default` entry that points to `enterpriseSceneTheme` / `enterpriseLightSceneTheme`.
- Keep all other preset exports (`darkGlassSceneTheme`, etc.) — they are re-exported from `index.ts` and consumed by `@brewsite/themes`.

The `enterpriseSceneTheme` and `enterpriseLightSceneTheme` named exports remain in `presets.ts` for backward compatibility during the transition (they are used by `sceneThemeRegistry.ts` internally, and will be removed from the public `index.ts` export in a follow-on cleanup).

Updated `SCENE_THEME_PAIRS`:
```typescript
export const SCENE_THEME_PAIRS: Record<ThemeFamily, { dark: SceneTheme; light: SceneTheme }> = {
  default:     { dark: enterpriseSceneTheme,      light: enterpriseLightSceneTheme },
  darkGlass:   { dark: darkGlassSceneTheme,       light: darkGlassLightSceneTheme },
  midnight:    { dark: midnightSceneTheme,        light: midnightLightSceneTheme },
  neonCyber:   { dark: neonCyberSceneTheme,       light: neonCyberLightSceneTheme },
  lightCanvas: { dark: lightCanvasDarkSceneTheme, light: lightCanvasSceneTheme },
  lightMinimal:{ dark: lightMinimalDarkSceneTheme, light: lightMinimalSceneTheme },
} as const;
```

Note: `SCENE_THEME_PAIRS` remains exported from `presets.ts` for use by `SceneEngine.tsx` (which still uses it to resolve `sceneTheme` when the old `themeFamily`/`themePolarity` props are in use). This is a transitional state — the `SceneEngine` prop redesign in Step 7 replaces this path.

### Step 4 — `@brewsite/core`: Update `SceneSnapshotContext`

**File: `packages/core/src/compiler/sceneTypes.ts`**

Add `themeFamily` and `themePolarity` to `SceneSnapshotContext`:

```typescript
import type { ThemeFamily } from '../theme/types';

export type SceneSnapshotContext = {
  /** 0-based index of this scene in the scene array. */
  sceneIndex: number;
  /** Total number of scenes. */
  numScenes: number;
  /** Whether model/texture assets have finished loading. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
  /**
   * Active theme family for this engine instance.
   * Passed from SceneEngine.theme into every NodeHandler via CompileApi.context.
   * Defaults to 'default' when no theme is configured.
   */
  themeFamily: ThemeFamily;
  /**
   * Active theme polarity for this engine instance.
   * Defaults to 'dark' when no theme is configured.
   */
  themePolarity: 'dark' | 'light';
};
```

### Step 5 — `@brewsite/core`: Trace the compile pipeline for `themeFamily` / `themePolarity`

The full call chain from `SceneEngine.theme` to `api.context.themeFamily` is:

**1. `SceneEngine.tsx` receives `theme?: ActiveTheme`**

```tsx
// SceneEngine.tsx
import type { ActiveTheme } from '../theme/types';

// New prop replaces themeFamily + themePolarity + sceneTheme (all three).
// Old props are deprecated but kept for one cycle for existing callers.
interface SceneEngineProps {
  // ...existing props...
  theme?: ActiveTheme;
  // DEPRECATED: use theme={...} instead
  sceneTheme?: SceneTheme;
  themeFamily?: ThemeFamily;
  themePolarity?: ThemePolarity;
}
```

**2. `SceneEngine.tsx` computes resolved `ActiveTheme` and `resolvedSceneTheme`**

```typescript
const resolvedActiveTheme = useMemo((): ActiveTheme => {
  if (props.theme) return props.theme;
  // Backward compat: old themeFamily prop
  if (props.themeFamily) {
    return { family: props.themeFamily, polarity: props.themePolarity ?? 'dark' };
  }
  return { family: 'default', polarity: 'dark' };
}, [props.theme, props.themeFamily, props.themePolarity]);

const resolvedSceneTheme = useMemo((): SceneTheme | undefined => {
  if (props.sceneTheme) return props.sceneTheme;
  return resolveSceneTheme(resolvedActiveTheme.family, resolvedActiveTheme.polarity);
}, [props.sceneTheme, resolvedActiveTheme]);
```

Import `resolveSceneTheme` from `'../theme/sceneThemeRegistry'`.

**3. `SceneEngine.tsx` passes `resolvedActiveTheme` into `useSceneEngine`**

```typescript
const engine = useSceneEngine({
  scenes,
  widgetRegistry,
  plugins: resolvedPlugins,
  manifest,
  sceneTheme: resolvedSceneTheme ?? null,
  activeTheme: resolvedActiveTheme,        // NEW
  // ...rest unchanged
});
```

**4. `useSceneEngine.ts` options receives `activeTheme`**

```typescript
export type UseSceneEngineOptions = {
  // ...existing fields unchanged...
  sceneTheme?: SceneTheme | null;
  activeTheme?: ActiveTheme;  // NEW — defaults to { family: 'default', polarity: 'dark' }
};
```

**5. `useSceneEngine.ts` passes `activeTheme` to `sceneDefs`**

The `sceneDefs` memo converts `InternalSceneSpec[]` into `SceneDefinition[]`. Currently:
```typescript
const sceneDefs = useMemo(
  (): SceneDefinition[] =>
    options.scenes.map((spec) => ({
      id: spec.sceneKey,
      getFrame: () => spec.element,
    })),
  [options.scenes],
);
```

The `SceneDefinition.getFrame` receives a `SceneSnapshotContext`. That context is built inside `sceneTrackCompiler.ts` (Step 6). No change is needed in `sceneDefs` itself — the context is built one level lower.

**6. `sceneTrackCompiler.ts` builds `SceneSnapshotContext` with `themeFamily` / `themePolarity`**

**File: `packages/core/src/compiler/sceneTrackCompiler.ts`**

The compilation options must accept `activeTheme`:

```typescript
export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion?: boolean;
  activeTheme?: ActiveTheme;  // NEW
};
```

In the snapshot-building loop:
```typescript
const snapshots: SceneFrame[] = scenes.map((scene, i) => {
  const context: SceneSnapshotContext = {
    sceneIndex: i,
    numScenes: scenes.length,
    assetsReady: true,
    themeFamily:   options.activeTheme?.family   ?? 'default',
    themePolarity: options.activeTheme?.polarity ?? 'dark',
  };
  // ...rest unchanged
});
```

**7. `useSceneEngine.ts` passes `activeTheme` into `compileSceneTrack`**

```typescript
const compiled = compileSceneTrack({
  scenes: sceneDefs,
  widgetRegistry: options.widgetRegistry,
  blockSize,
  prefersReducedMotion,
  activeTheme: options.activeTheme,  // NEW
});
```

The cache key must also incorporate `activeTheme` so theme changes invalidate the compiled track:

**File: `packages/core/src/compiler/sceneTrackCache.ts`** (or wherever `buildSceneTrackKey` lives):

Add `activeTheme?: ActiveTheme` to the key options. Serialize it as `${family}:${polarity}` appended to the key string.

**Summary of the compile chain:**
```
SceneEngine.theme prop
  → resolvedActiveTheme (useMemo in SceneEngine.tsx)
    → useSceneEngine({ activeTheme })
      → compileSceneTrack({ activeTheme })
        → context = { themeFamily, themePolarity, ... }
          → scene.getFrame(context)
            → resolveSceneFromDsl(tree, context, ...)
              → NodeHandler receives api.context.themeFamily / api.context.themePolarity
```

### Step 6 — `@brewsite/core`: Update `SceneEngine.tsx` props

**File: `packages/core/src/player/SceneEngine.tsx`**

Full prop changes:

1. Add `theme?: ActiveTheme` prop.
2. Keep `sceneTheme?`, `themeFamily?`, `themePolarity?` for one deprecation cycle.
3. Remove `ThemeKeyContext.Provider` wrapping from the render output — this context is being replaced by the compile-time path.
4. Keep `ThemeContext.Provider` (provides `resolvedSceneTheme` for `EngineOverlayHost` CSS variable injection — this is still needed).

```tsx
// Before:
const themeKey = useMemo((): ThemeKey | null => {
  if (props.themeFamily) {
    return { family: props.themeFamily, polarity: props.themePolarity ?? 'dark' };
  }
  return null;
}, [props.themeFamily, props.themePolarity]);
// ... ThemeKeyContext.Provider wrapping ...

// After:
// ThemeKey is gone. No ThemeKeyContext.Provider. Only ThemeContext remains.
```

The final render:
```tsx
return (
  <ThemeContext.Provider value={resolvedSceneTheme ?? null}>
    <SceneRegistrationContext.Provider value={registrationContextValue}>
      <VariableStoreContext.Provider value={engine.variableStore}>
        <PluginInheritanceContext.Provider value={resolvedPlugins}>
          {innerContent}
        </PluginInheritanceContext.Provider>
      </VariableStoreContext.Provider>
    </SceneRegistrationContext.Provider>
  </ThemeContext.Provider>
);
```

### Step 7 — `@brewsite/core`: Update `index.ts` exports

**File: `packages/core/src/theme/index.ts`**

1. Add exports:
   - `ActiveTheme` (type export from `types.ts`)
   - `registerSceneThemePair` (from `sceneThemeRegistry.ts`)
   - `resolveSceneTheme` (from `sceneThemeRegistry.ts`)

2. Keep existing exports for one cycle (deprecation), then remove:
   - `ThemeKeyContext`, `useThemeKey`, `ThemeKey` — keep exported but mark as deprecated via JSDoc `@deprecated`
   - `SCENE_THEME_PAIRS` — keep for now, needed by `@brewsite/themes` bundle files
   - `enterpriseSceneTheme`, `enterpriseLightSceneTheme` — keep but mark as deprecated

3. Remove from exports:
   - `SceneThemePair` type (moved internal to `sceneThemeRegistry.ts`)

### Step 8 — `@brewsite/diagram`: Create `themeRegistry.ts`

**New file: `packages/diagram/src/elements/diagram/themeRegistry.ts`**

```typescript
// Internal registry for DiagramTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init from the enterprise preset.
// Other families are registered by @brewsite/themes at app startup.

import type { ThemeFamily } from '@brewsite/core';
import type { DiagramTheme } from './types';
import { enterpriseTheme } from './themes/enterprise';
import { enterpriseLightTheme } from './themes/enterpriseLight';

type DiagramThemePair = { dark: DiagramTheme; light: DiagramTheme };

const registry = new Map<ThemeFamily, DiagramThemePair>();

// Pre-load 'default' from the enterprise aesthetic.
registry.set('default', {
  dark: enterpriseTheme,
  light: enterpriseLightTheme,
});

export function registerDiagramThemePair(
  family: ThemeFamily,
  pair: DiagramThemePair,
): void {
  registry.set(family, pair);
}

export function resolveDiagramTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): DiagramTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}
```

### Step 9 — `@brewsite/diagram`: Update the diagram NodeHandler

**File: `packages/diagram/src/compiler/handlers.ts`**

The `Diagram` NodeHandler currently calls `compileDiagram(dsl, undefined, onWarn)` where `undefined` for `fallbackTheme` causes it to use `darkGlassTheme`. Replace this with registry resolution:

```typescript
import { resolveDiagramTheme } from '../elements/diagram/themeRegistry';

registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const onWarn = makeWarnFn(api);
  const dsl = extractDiagramDSL(node, helpers, onWarn);

  // Resolve theme from engine context via registry.
  // dsl.theme is no longer read — it is removed from DiagramProps.
  const resolvedTheme = resolveDiagramTheme(
    api.context.themeFamily,
    api.context.themePolarity,
  );

  // ... composeBounds, composeZ, composeOpacity unchanged ...

  let diagramState = compileDiagram(
    { ...dsl, x: composedBounds.x, y: composedBounds.y, w: composedBounds.w, h: composedBounds.h, z: composedZ },
    resolvedTheme,
    onWarn,
  );
  // ... rest unchanged
});
```

The `extractDiagramDSL` function in the same file should no longer extract the `theme` prop from `node.props`. Remove `const theme = props.theme as DiagramTheme | undefined;` and remove `theme` from the returned object.

### Step 10 — `@brewsite/diagram`: Remove `DiagramProps.theme`

**File: `packages/diagram/src/elements/diagram/dsl.tsx`**

Remove `theme?: DiagramThemeName | DiagramTheme;` from `DiagramProps`. The prop comment block and the `@example` imports referencing theme presets also go.

### Step 11 — `@brewsite/diagram`: Update `themes/index.ts`

**File: `packages/diagram/src/elements/diagram/themes/index.ts`**

1. Remove `DIAGRAM_THEMES`, `DIAGRAM_THEME_PAIRS` exports (moved to `@brewsite/themes`).
2. Remove `import { SCENE_THEME_PAIRS } from '@brewsite/core'` and all the `_darkGlassDark`, `_darkGlassLight`, etc. computed pairs.
3. Keep individual theme preset exports (`darkGlassTheme`, `enterpriseTheme`, etc.) — they are imported by `@brewsite/themes` bundle files.
4. Keep `mergeTheme`, `withColorMode` exports — they move to `@brewsite/themes` as `mergeThemeBundle` but keep their original exports for backward compat.
5. Export `registerDiagramThemePair` and `resolveDiagramTheme` from the new `themeRegistry.ts` via this index.

New `packages/diagram/src/elements/diagram/themes/index.ts`:
```typescript
export { darkGlassTheme }      from './darkGlass';
export { midnightTheme }       from './midnight';
export { neonCyberTheme }      from './neonCyber';
export { enterpriseTheme }     from './enterprise';
export { lightCanvasTheme }    from './lightCanvas';
export { lightMinimalTheme }   from './lightMinimal';
export { darkGlassLightTheme }   from './darkGlassLight';
export { midnightLightTheme }    from './midnightLight';
export { neonCyberLightTheme }   from './neonCyberLight';
export { enterpriseLightTheme }  from './enterpriseLight';
export { lightCanvasDarkTheme }  from './lightCanvasDark';
export { lightMinimalDarkTheme } from './lightMinimalDark';
export { mergeTheme, withColorMode } from './mergeTheme';
export { registerDiagramThemePair, resolveDiagramTheme } from '../themeRegistry';
```

The package-level `packages/diagram/src/index.ts` (or wherever `registerDiagramThemePair` should be public) must re-export `registerDiagramThemePair` and `resolveDiagramTheme`. Check the existing diagram `index.ts` and add these exports there.

### Step 12 — `@brewsite/charts`: Create `chartThemeRegistry.ts`

**New file: `packages/charts/src/themes/chartThemeRegistry.ts`**

```typescript
// Internal registry for ChartTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init from the enterprise preset.
// Other families are registered by @brewsite/themes at app startup.

import type { ThemeFamily } from '@brewsite/core';
import type { ChartTheme } from './types';
import { enterpriseChartTheme } from './enterprise';
import { enterpriseLightChartTheme } from './enterpriseLight';

type ChartThemePair = { dark: ChartTheme; light: ChartTheme };

const registry = new Map<ThemeFamily, ChartThemePair>();

// Pre-load 'default' from the enterprise aesthetic.
registry.set('default', {
  dark: enterpriseChartTheme,
  light: enterpriseLightChartTheme,
});

export function registerChartThemePair(
  family: ThemeFamily,
  pair: ChartThemePair,
): void {
  registry.set(family, pair);
}

export function resolveChartTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): ChartTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}
```

Note: This `resolveChartTheme` function has a different signature than the existing `resolveChartTheme` in `packages/charts/src/themes/resolveTheme.ts` (which accepts `ChartThemeName | ChartTheme`). The existing function is used by chart rendering internals that read from the DSL `theme` prop. After `BaseChartDSL.theme` is removed, the chart compile handler will use the registry version instead. Rename the old `resolveTheme.ts` function to `resolveChartThemeByName` or delete it once no callsites remain.

### Step 13 — `@brewsite/charts`: Remove `BaseChartDSL.theme` and `BaseChartDSL.sceneTheme`

**File: `packages/charts/src/elements/chart/dsl.tsx`**

Remove from `BaseChartDSL`:
```typescript
readonly theme?: ChartThemeName | ChartTheme;   // REMOVE
readonly sceneTheme?: SceneTheme;               // REMOVE
```

The chart compile handler (find it in `packages/charts/src/` — likely `compiler/chartHandler.ts` or similar) must be updated to resolve the chart theme from `chartThemeRegistry` using `api.context.themeFamily` and `api.context.themePolarity` instead of reading `dsl.theme`.

### Step 14 — `@brewsite/charts`: Update `themes/index.ts`

**File: `packages/charts/src/themes/index.ts`**

1. Remove `CHART_THEMES`, `CHART_THEME_PAIRS` exports.
2. Remove the `_darkGlassDark`, etc. computed pairs and `import { SCENE_THEME_PAIRS }`.
3. Keep individual preset exports (`darkGlassChartTheme`, etc.) — needed by `@brewsite/themes`.
4. Keep `createChartTheme` export — it stays in charts for custom theme creation.
5. Add export of `registerChartThemePair` and `resolveChartTheme` from `chartThemeRegistry.ts`.

### Step 15 — `@brewsite/core`: SpotlightRig cleanup

**File: `packages/core/src/elements/spotlight-rig/types.ts`**

1. Keep `SpotlightRigTheme` as a type but add `@internal` JSDoc. It is no longer a public API surface — it is only used internally by `compile.ts`.
2. Add new exported type:

```typescript
/**
 * Standalone cinematic preset for SpotlightRig.
 * Distinct from SpotlightRigTheme (which is an internal compile-time contract).
 * These presets are independent of any ThemeFamily.
 */
export type SpotlightRigPreset = SpotlightRigTheme;
```

**File: `packages/core/src/elements/spotlight-rig/compile.ts`**

1. Remove `mergeSpotlightRigTheme` export (it becomes internal — the function can stay as a private helper or be inlined).

2. Add internal `SPOTLIGHT_PRESETS` lookup table:

```typescript
import type { SpotlightRigTheme } from './types';
import type { ThemeFamily } from '../../theme/types';

// Internal presets keyed by ThemeFamily. Not exported.
// Used to auto-apply family-appropriate defaults when resolveSpotlightRig
// is called with context.themeFamily set.
const SPOTLIGHT_PRESETS: Partial<Record<ThemeFamily, SpotlightRigTheme>> = {
  darkGlass: {
    color: '#FFD0A0',
    intensity: 100,
    speed: 0.3,
    radius: 16,
    height: 28,
    targetY: 0,
    angle: Math.PI / 18,
    penumbra: 0.20,
    decay: 2.0,
    distance: 65,
    castShadow: false,
    shadowMapSize: 1024,
    showBeam: true,
    beamOpacity: 0.11,
    beamColor: '#FFE8CC',
    showHalo: false,
    haloOpacity: 0.25,
    haloSize: 7,
  },
  neonCyber: {
    color: '#00E7FF',
    intensity: 160,
    speed: 1.4,
    radius: 14,
    height: 24,
    targetY: 0,
    angle: Math.PI / 20,
    penumbra: 0.12,
    decay: 2.0,
    distance: 55,
    castShadow: false,
    shadowMapSize: 1024,
    showBeam: true,
    beamOpacity: 0.18,
    beamColor: '#80F4FF',
    showHalo: true,
    haloOpacity: 0.40,
    haloSize: 9,
  },
  lightMinimal: {
    color: '#FFF8F0',
    intensity: 25,
    speed: 0.25,
    radius: 20,
    height: 30,
    targetY: 0,
    angle: Math.PI / 8,
    penumbra: 0.7,
    decay: 2.0,
    distance: 70,
    castShadow: false,
    shadowMapSize: 1024,
    showBeam: false,
    beamOpacity: 0.0,
    beamColor: '#ffffff',
    showHalo: false,
    haloOpacity: 0.0,
    haloSize: 6,
  },
  // 'default' uses DEFAULT_SPOTLIGHT_RIG_THEME (no entry needed — fallback)
  // 'midnight' and 'lightCanvas' use DEFAULT_SPOTLIGHT_RIG_THEME (no family entry)
};
```

3. Update `resolveSpotlightRig` signature to accept optional `themeFamily`:

```typescript
export function resolveSpotlightRig(
  rigProps: SpotlightRigProps,
  lightPropsList: SpotlightProps[],
  context: SceneSnapshotContext,
): SpotlightRigState {
  // Resolve family-specific preset if available, otherwise use DEFAULT.
  const familyPreset = SPOTLIGHT_PRESETS[context.themeFamily];
  const base: SpotlightRigTheme = familyPreset ?? DEFAULT_SPOTLIGHT_RIG_THEME;
  // props.theme override is removed — theme prop no longer exists on SpotlightRigProps.
  const theme: SpotlightRigTheme = base;
  // ... rest of function unchanged
}
```

**File: `packages/core/src/elements/spotlight-rig/dsl.tsx`** (check if `theme?` prop exists)

If `SpotlightRigProps.theme` exists in `dsl.tsx`, remove it.

**File: `packages/core/src/elements/spotlight-rig/index.ts`**

New exports after change:
```typescript
export { SpotlightRig, Spotlight, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps, SpotlightProps } from './dsl';
export type {
  SpotlightRigState,
  SpotlightLightState,
  OrbitFn,
  Vec3Tuple as SpotlightRigVec3,
  SpotlightRigPreset,         // NEW — replaces SpotlightRigTheme as public API
} from './types';
// SpotlightRigTheme is NOT re-exported (now @internal)
export {
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_STATE,
  // mergeSpotlightRigTheme is removed
} from './compile';
export {
  moviePremierePreset,         // renamed from moviePremiereTheme
  concertStagePreset,          // renamed from concertStageTheme
} from './themes';
// spotlightDarkGlassTheme, spotlightEnterpriseTheme, spotlightNeonCyberTheme,
// spotlightLightMinimalTheme are NOT re-exported (removed)
```

**File: `packages/core/src/elements/spotlight-rig/themes/moviePremiere.ts`**

Rename export:
```typescript
export const moviePremierePreset: SpotlightRigPreset = { /* same values */ };
// Keep old name as deprecated alias for one cycle:
/** @deprecated Use moviePremierePreset */
export const moviePremiereTheme = moviePremierePreset;
```

**File: `packages/core/src/elements/spotlight-rig/themes/concertStage.ts`**

Same pattern:
```typescript
export const concertStagePreset: SpotlightRigPreset = { /* same values */ };
/** @deprecated Use concertStagePreset */
export const concertStageTheme = concertStagePreset;
```

**File: `packages/core/src/elements/spotlight-rig/themes/index.ts`**

```typescript
export { moviePremierePreset, moviePremiereTheme } from './moviePremiere';
export { concertStagePreset, concertStageTheme } from './concertStage';
// darkGlass, enterprise, neonCyber, lightMinimal are deleted
```

**Delete files:**
- `packages/core/src/elements/spotlight-rig/themes/darkGlass.ts`
- `packages/core/src/elements/spotlight-rig/themes/enterprise.ts`
- `packages/core/src/elements/spotlight-rig/themes/neonCyber.ts`
- `packages/core/src/elements/spotlight-rig/themes/lightMinimal.ts`

### Step 16 — Build `@brewsite/themes`: Type definitions

**New file: `packages/themes/src/types.ts`**

```typescript
// ThemeBundle — the complete cross-package theme data for a single family.

import type { ThemeFamily, SceneTheme } from '@brewsite/core';
import type { DiagramTheme } from '@brewsite/diagram';
import type { ChartTheme } from '@brewsite/charts';

export interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene: {
    readonly dark: SceneTheme;
    readonly light: SceneTheme;
  };
  readonly diagram: {
    readonly dark: DiagramTheme;
    readonly light: DiagramTheme;
  };
  readonly chart: {
    readonly dark: ChartTheme;
    readonly light: ChartTheme;
  };
}
```

### Step 17 — Build `@brewsite/themes`: `activeThemes.ts`

**New file: `packages/themes/src/activeThemes.ts`**

```typescript
// Pre-built ActiveTheme object literals for all families and polarities.
// These are plain const objects — no runtime computation.

import type { ActiveTheme } from '@brewsite/core';

export const darkGlass = {
  dark:  { family: 'darkGlass',    polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'darkGlass',    polarity: 'light' } as const satisfies ActiveTheme,
};

export const midnight = {
  dark:  { family: 'midnight',     polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'midnight',     polarity: 'light' } as const satisfies ActiveTheme,
};

export const neonCyber = {
  dark:  { family: 'neonCyber',    polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'neonCyber',    polarity: 'light' } as const satisfies ActiveTheme,
};

export const lightCanvas = {
  dark:  { family: 'lightCanvas',  polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'lightCanvas',  polarity: 'light' } as const satisfies ActiveTheme,
};

export const lightMinimal = {
  dark:  { family: 'lightMinimal', polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'lightMinimal', polarity: 'light' } as const satisfies ActiveTheme,
};

export const defaultTheme = {
  dark:  { family: 'default',      polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'default',      polarity: 'light' } as const satisfies ActiveTheme,
};
```

### Step 18 — Build `@brewsite/themes`: Bundle files

Each bundle file imports from `@brewsite/core` (scene presets), `@brewsite/diagram` (diagram presets), and `@brewsite/charts` (chart presets), and assembles a `ThemeBundle`.

**New file: `packages/themes/src/bundles/darkGlass.ts`**

```typescript
import type { ThemeBundle } from '../types';

// Scene presets
import { darkGlassSceneTheme, darkGlassLightSceneTheme } from '@brewsite/core';

// Diagram presets
import { darkGlassTheme as diagramDark }      from '@brewsite/diagram';
import { darkGlassLightTheme as diagramLight } from '@brewsite/diagram';

// Chart presets
import { darkGlassChartTheme as chartDark }      from '@brewsite/charts';
import { darkGlassLightChartTheme as chartLight } from '@brewsite/charts';

// Wire sceneTheme into diagram and chart themes at bundle assembly time.
// This replaces the pre-computed DIAGRAM_THEME_PAIRS and CHART_THEME_PAIRS.
const diagramDarkFull  = { ...diagramDark,  sceneTheme: darkGlassSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: darkGlassLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: darkGlassSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: darkGlassLightSceneTheme };

export const darkGlassBundle: ThemeBundle = {
  family: 'darkGlass',
  scene:   { dark: darkGlassSceneTheme,      light: darkGlassLightSceneTheme },
  diagram: { dark: diagramDarkFull,          light: diagramLightFull },
  chart:   { dark: chartDarkFull,            light: chartLightFull },
};
```

**New file: `packages/themes/src/bundles/midnight.ts`**

```typescript
import type { ThemeBundle } from '../types';
import { midnightSceneTheme, midnightLightSceneTheme } from '@brewsite/core';
import { midnightTheme as diagramDark }      from '@brewsite/diagram';
import { midnightLightTheme as diagramLight } from '@brewsite/diagram';
import { midnightChartTheme as chartDark }      from '@brewsite/charts';
import { midnightLightChartTheme as chartLight } from '@brewsite/charts';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: midnightSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: midnightLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: midnightSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: midnightLightSceneTheme };

export const midnightBundle: ThemeBundle = {
  family: 'midnight',
  scene:   { dark: midnightSceneTheme,        light: midnightLightSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
```

**New file: `packages/themes/src/bundles/neonCyber.ts`**

```typescript
import type { ThemeBundle } from '../types';
import { neonCyberSceneTheme, neonCyberLightSceneTheme } from '@brewsite/core';
import { neonCyberTheme as diagramDark }      from '@brewsite/diagram';
import { neonCyberLightTheme as diagramLight } from '@brewsite/diagram';
import { neonCyberChartTheme as chartDark }      from '@brewsite/charts';
import { neonCyberLightChartTheme as chartLight } from '@brewsite/charts';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: neonCyberSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: neonCyberLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: neonCyberSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: neonCyberLightSceneTheme };

export const neonCyberBundle: ThemeBundle = {
  family: 'neonCyber',
  scene:   { dark: neonCyberSceneTheme,       light: neonCyberLightSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
```

**New file: `packages/themes/src/bundles/lightCanvas.ts`**

```typescript
import type { ThemeBundle } from '../types';
import { lightCanvasSceneTheme, lightCanvasDarkSceneTheme } from '@brewsite/core';
import { lightCanvasTheme as diagramLight }     from '@brewsite/diagram';
import { lightCanvasDarkTheme as diagramDark }   from '@brewsite/diagram';
import { lightCanvasChartTheme as chartLight }   from '@brewsite/charts';
import { lightCanvasDarkChartTheme as chartDark } from '@brewsite/charts';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: lightCanvasDarkSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: lightCanvasSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: lightCanvasDarkSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: lightCanvasSceneTheme };

export const lightCanvasBundle: ThemeBundle = {
  family: 'lightCanvas',
  scene:   { dark: lightCanvasDarkSceneTheme, light: lightCanvasSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
```

**New file: `packages/themes/src/bundles/lightMinimal.ts`**

```typescript
import type { ThemeBundle } from '../types';
import { lightMinimalSceneTheme, lightMinimalDarkSceneTheme } from '@brewsite/core';
import { lightMinimalTheme as diagramLight }     from '@brewsite/diagram';
import { lightMinimalDarkTheme as diagramDark }   from '@brewsite/diagram';
import { lightMinimalChartTheme as chartLight }   from '@brewsite/charts';
import { lightMinimalDarkChartTheme as chartDark } from '@brewsite/charts';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: lightMinimalDarkSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: lightMinimalSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: lightMinimalDarkSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: lightMinimalSceneTheme };

export const lightMinimalBundle: ThemeBundle = {
  family: 'lightMinimal',
  scene:   { dark: lightMinimalDarkSceneTheme, light: lightMinimalSceneTheme },
  diagram: { dark: diagramDarkFull,            light: diagramLightFull },
  chart:   { dark: chartDarkFull,              light: chartLightFull },
};
```

**New file: `packages/themes/src/bundles/index.ts`**

```typescript
export { darkGlassBundle  as darkGlass }   from './darkGlass';
export { midnightBundle   as midnight }    from './midnight';
export { neonCyberBundle  as neonCyber }   from './neonCyber';
export { lightCanvasBundle as lightCanvas } from './lightCanvas';
export { lightMinimalBundle as lightMinimal } from './lightMinimal';
```

### Step 19 — Build `@brewsite/themes`: `merge.ts`

**New file: `packages/themes/src/merge.ts`**

`mergeThemeBundle` accepts a base `ThemeBundle` and deep-partial overrides for each slice. This replaces `mergeTheme()` in diagram and `createChartTheme()` in charts for cross-package customization (individual-package helpers remain for package-local overrides).

```typescript
import type { ThemeBundle } from './types';
import { mergeTheme } from '@brewsite/diagram';
import { createChartTheme } from '@brewsite/charts';
import type { SceneTheme } from '@brewsite/core';
import type { DiagramTheme } from '@brewsite/diagram';
import type { ChartTheme, ChartThemeOverrides } from '@brewsite/charts';

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type ThemeBundleOverrides = {
  readonly scene?: {
    readonly dark?: DeepPartial<SceneTheme>;
    readonly light?: DeepPartial<SceneTheme>;
  };
  readonly diagram?: {
    readonly dark?: DeepPartial<DiagramTheme>;
    readonly light?: DeepPartial<DiagramTheme>;
  };
  readonly chart?: {
    readonly dark?: Partial<ChartThemeOverrides>;
    readonly light?: Partial<ChartThemeOverrides>;
  };
};

/**
 * Produces a new ThemeBundle by merging overrides onto a base bundle.
 * All three slices (scene, diagram, chart) can be independently overridden
 * for dark and/or light polarities. The base bundle is not mutated.
 *
 * @example
 * const brandBundle = mergeThemeBundle(bundles.darkGlass, {
 *   scene: {
 *     dark: { background: { fill: { kind: 'color', value: '#0d0d1a' } } },
 *   },
 *   diagram: {
 *     dark: { node: { defaultColor: '#1a1030' } },
 *   },
 * });
 */
export function mergeThemeBundle(
  base: ThemeBundle,
  overrides: ThemeBundleOverrides = {},
): ThemeBundle {
  const sceneDark: SceneTheme  = overrides.scene?.dark
    ? deepMergeSceneTheme(base.scene.dark, overrides.scene.dark)
    : base.scene.dark;
  const sceneLight: SceneTheme = overrides.scene?.light
    ? deepMergeSceneTheme(base.scene.light, overrides.scene.light)
    : base.scene.light;

  const diagramDark: DiagramTheme  = overrides.diagram?.dark
    ? mergeTheme(base.diagram.dark,  overrides.diagram.dark  as Parameters<typeof mergeTheme>[1])
    : base.diagram.dark;
  const diagramLight: DiagramTheme = overrides.diagram?.light
    ? mergeTheme(base.diagram.light, overrides.diagram.light as Parameters<typeof mergeTheme>[1])
    : base.diagram.light;

  const chartDark: ChartTheme  = overrides.chart?.dark
    ? createChartTheme(base.chart.dark,  overrides.chart.dark)
    : base.chart.dark;
  const chartLight: ChartTheme = overrides.chart?.light
    ? createChartTheme(base.chart.light, overrides.chart.light)
    : base.chart.light;

  return {
    family: base.family,
    scene:   { dark: sceneDark,   light: sceneLight },
    diagram: { dark: diagramDark, light: diagramLight },
    chart:   { dark: chartDark,   light: chartLight },
  };
}

// Simple deep-merge for SceneTheme (plain object, no arrays that need special handling)
function deepMergeSceneTheme(base: SceneTheme, overrides: DeepPartial<SceneTheme>): SceneTheme {
  return deepMerge(base, overrides) as SceneTheme;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (val === undefined) continue;
    const baseVal = base[key];
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key as string] = deepMerge(baseVal as object, val as DeepPartial<typeof baseVal>);
    } else {
      result[key as string] = val;
    }
  }
  return result as T;
}
```

### Step 20 — Build `@brewsite/themes`: `plugin.ts`

**New file: `packages/themes/src/plugin.ts`**

```typescript
import type { WidgetPlugin } from '@brewsite/core';
import { registerSceneThemePair } from '@brewsite/core';
import { registerDiagramThemePair } from '@brewsite/diagram';
import { registerChartThemePair } from '@brewsite/charts';
import type { ThemeBundle } from './types';

// All named bundles — imported lazily so tree-shaking works when explicit list is given.
import { darkGlassBundle }   from './bundles/darkGlass';
import { midnightBundle }    from './bundles/midnight';
import { neonCyberBundle }   from './bundles/neonCyber';
import { lightCanvasBundle } from './bundles/lightCanvas';
import { lightMinimalBundle } from './bundles/lightMinimal';

const ALL_BUNDLES: ThemeBundle[] = [
  darkGlassBundle,
  midnightBundle,
  neonCyberBundle,
  lightCanvasBundle,
  lightMinimalBundle,
];

function registerBundle(bundle: ThemeBundle): void {
  registerSceneThemePair(bundle.family, { dark: bundle.scene.dark, light: bundle.scene.light });
  registerDiagramThemePair(bundle.family, { dark: bundle.diagram.dark, light: bundle.diagram.light });
  registerChartThemePair(bundle.family, { dark: bundle.chart.dark, light: bundle.chart.light });
}

/**
 * WidgetPlugin that registers theme bundles into the per-package registries.
 *
 * @param bundles - Optional explicit list of ThemeBundle objects to register.
 *   When omitted, ALL five named family bundles are registered (darkGlass, midnight,
 *   neonCyber, lightCanvas, lightMinimal). Pass an explicit array for bundle-size-
 *   conscious apps that only use one or two themes.
 *
 * @example
 * // Register all bundles (common case):
 * plugins={[corePlugin(), diagramPlugin({...}), themesPlugin()]}
 *
 * @example
 * // Register only darkGlass for a size-conscious deployment:
 * import { bundles } from '@brewsite/themes';
 * plugins={[corePlugin(), diagramPlugin({...}), themesPlugin([bundles.darkGlass])]}
 */
export function themesPlugin(bundles?: ThemeBundle[]): WidgetPlugin {
  const toRegister = bundles ?? ALL_BUNDLES;

  return {
    createWidgets(): [] {
      return [];
    },
    registerHandlers(): void {
      // No DSL handlers — themes are pure data.
    },
    configureRegistry(): void {
      for (const bundle of toRegister) {
        registerBundle(bundle);
      }
    },
  };
}
```

### Step 21 — Build `@brewsite/themes`: `index.ts`

**New file: `packages/themes/src/index.ts`**

```typescript
export { themesPlugin } from './plugin';
export type { ThemeBundle, ThemeBundleOverrides } from './types';
export * as bundles from './bundles';
export * as themes from './activeThemes';
export { mergeThemeBundle } from './merge';
```

Usage examples:
```typescript
import { themesPlugin, themes, bundles, mergeThemeBundle } from '@brewsite/themes';

// Active theme selectors:
themes.darkGlass.dark   // → { family: 'darkGlass', polarity: 'dark' }
themes.lightCanvas.light // → { family: 'lightCanvas', polarity: 'light' }

// Raw bundles for custom merge:
bundles.darkGlass        // → ThemeBundle
bundles.midnight         // → ThemeBundle
```

---

## 4. `apps/examples` Migration

### Pattern for every widgetSetup file

All 8 widgetSetup files follow the same pattern. They must:
1. Import `themesPlugin` and `themes` from `@brewsite/themes`.
2. Return `{ plugins, theme }` where `theme` is an `ActiveTheme`.

**Template (applied to all files):**

```typescript
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';
import type { ActiveTheme } from '@brewsite/core';

export function createArchitecturePlugins(): {
  plugins: WidgetPlugin[];
  theme: ActiveTheme;
} {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({ diagrams: ['arch-content'] }),
      themesPlugin(),
    ],
    theme: themes.darkGlass.dark,
  };
}
```

**Per-file theme choices** (use what the scenes were using before via `themeFamily`/`theme=` props):

| File | Theme |
|------|-------|
| `architecture/widgetSetup.ts` | `themes.darkGlass.dark` |
| `brewflow-comparison/widgetSetup.ts` | `themes.darkGlass.dark` |
| `brewflow-memory/widgetSetup.ts` | `themes.darkGlass.dark` |
| `brewflow-multiuser/widgetSetup.ts` | `themes.darkGlass.dark` |
| `brewflow-sidecar/widgetSetup.ts` | `themes.darkGlass.dark` |
| `chart/widgetSetup.ts` | `themes.lightCanvas.light` |
| `core-showcase/widgetSetup.ts` | `themes.darkGlass.dark` |
| `whiteboard-arch/widgetSetup.ts` | `themes.darkGlass.dark` |

For the chart widgetSetup, the existing `chartsPlugin` instance pattern stays intact:
```typescript
export function createChartDemoPlugins(): {
  plugins: WidgetPlugin[];
  chartsPlugin: ChartPluginInstance;
  theme: ActiveTheme;
} {
  const chartsPlugin = chartPlugin();
  return {
    plugins: [corePlugin(), chartsPlugin, themesPlugin()],
    chartsPlugin,
    theme: themes.lightCanvas.light,
  };
}
```

### Pattern for every Page component

Each Page component currently calls its widgetSetup function and passes the plugins to `<SceneEngine>`. After the change:

```tsx
// Before
const { plugins } = useMemo(() => createArchitecturePlugins(), []);
<SceneEngine plugins={plugins} themeFamily="darkGlass" themePolarity="dark">

// After
const { plugins, theme } = useMemo(() => createArchitecturePlugins(), []);
<SceneEngine plugins={plugins} theme={theme}>
```

Any `sceneTheme={...}`, `themeFamily={...}`, `themePolarity={...}` props on `<SceneEngine>` elements in the Page files must be replaced with the single `theme={theme}` prop.

### Pattern for scene files

Every scene file that has a `theme=` prop on `<Diagram>`, `<BarChart>`, `<LineChart>`, etc. must have those props removed:

```tsx
// Before
<Diagram id="arch-content" theme={darkGlassTheme} />
<BarChart id="revenue" theme={chartTheme} />
<Floor theme={myTheme} />

// After
<Diagram id="arch-content" />
<BarChart id="revenue" />
<Floor />
```

Imports of theme-related symbols in scene files must be removed:
- `import { darkGlassTheme } from '@brewsite/diagram'` — remove
- `import { CHART_THEME_PAIRS, DIAGRAM_THEME_PAIRS } from ...` — remove
- `import { useThemeKey } from '@brewsite/core'` — remove
- `import type { ChartTheme } from '@brewsite/charts'` — remove if only used for the theme prop

### `apps/examples/src/chart/scenes/sceneShared.tsx`

This file defines `ChartDemoThemeContext`, `ChartDemoThemeProvider`, and `useDemoChartTheme()`. These are a local convenience layer for the chart demo to pass the active `ChartTheme` to scenes. After the centralized system, the theme is resolved by the chart NodeHandler at compile time — the demo context is no longer needed.

Remove:
- `ChartDemoThemeContext`
- `ChartDemoThemeProvider`
- `useDemoChartTheme`
- `import { CHART_THEME_PAIRS } from '@brewsite/charts'`

Any chart demo scene that calls `useDemoChartTheme()` to get a `ChartTheme` and passes it to a chart DSL element must be updated: remove the `useDemoChartTheme()` call and remove the `theme={chartTheme}` prop.

Any chart demo scene that uses `useDemoChartTheme()` for non-DSL purposes (e.g., reading `chartTheme.series[0].color` for a custom overlay color) must be updated to use a static color or compute it from a different source.

### `apps/examples/src/chart/ChartDemoPage.tsx`

This file currently provides `ChartDemoThemeProvider`. Remove the provider and the theme switcher UI if it was tied to `CHART_THEME_PAIRS`. The active theme is now set via `SceneEngine.theme`.

### `apps/examples/src/theme-gallery/ThemeGalleryPage.tsx`

This page references `DIAGRAM_THEME_PAIRS`, `CHART_THEME_PAIRS`, and `SCENE_THEME_PAIRS`. After migration, it must import from `@brewsite/themes`:
```typescript
import { bundles, themes } from '@brewsite/themes';
// Use bundles.darkGlass, bundles.midnight, etc. directly
```

---

## 5. `SceneSnapshotContext` Default Value

When `SceneEngine` is used without a `theme` prop (which is allowed), the context must still have valid defaults:

```typescript
// In sceneTrackCompiler.ts snapshot loop:
const context: SceneSnapshotContext = {
  sceneIndex: i,
  numScenes: scenes.length,
  assetsReady: true,
  themeFamily:   options.activeTheme?.family   ?? 'default',
  themePolarity: options.activeTheme?.polarity ?? 'dark',
};
```

Registries fall back to `'default'` when the family is not found. The `'default'` pair is always present (pre-loaded at module init). This means a scene that uses `<Diagram>` without any theme configuration will render with the enterprise aesthetic — same as today.

---

## 6. Per-Package Default Theme: The `'default'` Preset

The `'default'` preset is the old `'enterprise'` aesthetic. The aesthetic is preserved exactly — only the name changes. This means:

- `packages/core/src/theme/presets.ts`: The existing `enterpriseSceneTheme` and `enterpriseLightSceneTheme` objects are unchanged. The `SCENE_THEME_PAIRS` gets a new `default` entry pointing to them.
- `packages/diagram/src/elements/diagram/themeRegistry.ts`: Pre-loads `'default'` with `enterpriseTheme` and `enterpriseLightTheme` objects unchanged.
- `packages/charts/src/themes/chartThemeRegistry.ts`: Pre-loads `'default'` with `enterpriseChartTheme` and `enterpriseLightChartTheme` objects unchanged.
- `packages/core/src/elements/spotlight-rig/compile.ts`: The `SPOTLIGHT_PRESETS` map has no entry for `'default'` — the `DEFAULT_SPOTLIGHT_RIG_THEME` constant is used as fallback (the enterprise spotlight used `spotlightEnterpriseTheme` which is similar to the default but with `beamOpacity: 0.08` vs `0.10`; the default preset is acceptable here since `DEFAULT_SPOTLIGHT_RIG_THEME` already has sensible values). If exact parity is needed, the `'default'` entry in `SPOTLIGHT_PRESETS` can be set to the old `spotlightEnterpriseTheme` values.

---

## 7. Testing Strategy

### Tests to delete

```
packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts
  — Delete test: 'props.theme applies theme values to resolved lights'
  — Delete test: any test referencing mergeSpotlightRigTheme
  — Keep all other tests intact

packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts
  — Delete tests referencing DIAGRAM_THEMES, DIAGRAM_THEME_PAIRS (moved to @brewsite/themes)
  — Keep mergeTheme tests

packages/diagram/src/elements/diagram/compiler/__tests__/themeResolver.test.ts
  — Keep intact (buildThemeRenderConfig, compileExitConfig, compileEnterConfig are unchanged)

packages/charts/src/themes/__tests__/chartThemePairs.test.ts
  — Delete entirely (tests CHART_THEME_PAIRS which is removed)

packages/charts/src/themes/__tests__/createChartTheme.test.ts
  — Keep intact (createChartTheme stays in @brewsite/charts)
```

### Tests to update

**`packages/core/src/compiler/__tests__/sceneDslCompiler.test.tsx`**

Add tests for `themeFamily` and `themePolarity` flowing through context:
```typescript
it('themeFamily defaults to default when no active theme is set', () => {
  const context = makeContext({ themeFamily: 'default', themePolarity: 'dark' });
  // compile a scene and assert api.context.themeFamily === 'default'
});

it('themeFamily is passed through to NodeHandlers via api.context', () => {
  // Register a test handler that captures api.context.themeFamily
  // Compile with a custom activeTheme and assert it matches
});
```

**`packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts`**

Add context with `themeFamily`:
```typescript
const makeContext = (sceneIndex = 0, family: ThemeFamily = 'default'): SceneSnapshotContext => ({
  sceneIndex,
  numScenes: 3,
  assetsReady: true,
  themeFamily: family,
  themePolarity: 'dark',
});

it('themeFamily darkGlass applies darkGlass spotlight preset', () => {
  const state = resolveSpotlightRig({}, [{}], makeContext(0, 'darkGlass'));
  expect(state.lights[0]!.color).toBe('#FFD0A0');
});

it('themeFamily neonCyber applies neonCyber spotlight preset', () => {
  const state = resolveSpotlightRig({}, [{}], makeContext(0, 'neonCyber'));
  expect(state.lights[0]!.color).toBe('#00E7FF');
  expect(state.lights[0]!.showHalo).toBe(true);
});

it('unknown or default themeFamily uses DEFAULT_SPOTLIGHT_RIG_THEME', () => {
  const state = resolveSpotlightRig({}, [{}], makeContext(0, 'default'));
  expect(state.lights[0]!.color).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.color);
});
```

**`packages/core/src/theme/__tests__/presets.test.ts`**

Update to reflect `'default'` in `SCENE_THEME_PAIRS` and absence of `'enterprise'`:
```typescript
it('SCENE_THEME_PAIRS has default family', () => {
  expect(SCENE_THEME_PAIRS['default']).toBeDefined();
  expect(SCENE_THEME_PAIRS['default'].dark.colorMode).toBe('dark');
});

it('SCENE_THEME_PAIRS does not have enterprise family', () => {
  expect((SCENE_THEME_PAIRS as Record<string, unknown>)['enterprise']).toBeUndefined();
});
```

**`packages/core/src/compiler/__tests__/registry.test.ts`**

Update any test context objects to include `themeFamily: 'default'` and `themePolarity: 'dark'` since `SceneSnapshotContext` now requires these fields.

### New tests to create

**`packages/core/src/theme/__tests__/sceneThemeRegistry.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { registerSceneThemePair, resolveSceneTheme } from '../sceneThemeRegistry';
import { darkGlassSceneTheme } from '../presets';

describe('sceneThemeRegistry', () => {
  it('resolves default dark without any registration', () => {
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme.colorMode).toBe('dark');
  });

  it('falls back to default for unknown family', () => {
    const theme = resolveSceneTheme('darkGlass' as never, 'dark');
    // darkGlass is not registered in isolation — falls back to default
    // After themesPlugin runs, this would resolve to darkGlass
  });

  it('registered family overrides default fallback', () => {
    registerSceneThemePair('darkGlass', {
      dark: darkGlassSceneTheme,
      light: darkGlassSceneTheme, // light not tested here
    });
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme.background?.fill).toEqual(darkGlassSceneTheme.background?.fill);
  });
});
```

**`packages/themes/src/__tests__/plugin.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { themesPlugin } from '../plugin';
import * as coreRegistry from '@brewsite/core';
import * as diagramRegistry from '@brewsite/diagram';
import * as chartsRegistry from '@brewsite/charts';

describe('themesPlugin', () => {
  it('registerHandlers is a no-op', () => {
    const plugin = themesPlugin();
    expect(() => plugin.registerHandlers()).not.toThrow();
  });

  it('createWidgets returns empty array', () => {
    const plugin = themesPlugin();
    expect(plugin.createWidgets()).toHaveLength(0);
  });

  it('configureRegistry calls registerSceneThemePair for all 5 families', () => {
    const spy = vi.spyOn(coreRegistry, 'registerSceneThemePair');
    const mockReg = {} as never;
    themesPlugin().configureRegistry!(mockReg, null);
    expect(spy).toHaveBeenCalledTimes(5);
    expect(spy).toHaveBeenCalledWith('darkGlass', expect.any(Object));
  });

  it('configureRegistry with explicit bundle list registers only those families', () => {
    const spy = vi.spyOn(coreRegistry, 'registerSceneThemePair');
    spy.mockClear();
    const { darkGlassBundle } = await import('../bundles/darkGlass');
    const mockReg = {} as never;
    themesPlugin([darkGlassBundle]).configureRegistry!(mockReg, null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('darkGlass', expect.any(Object));
  });
});
```

**`packages/themes/src/__tests__/bundles.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import * as bundles from '../bundles';

describe('bundles', () => {
  const familyNames = ['darkGlass', 'midnight', 'neonCyber', 'lightCanvas', 'lightMinimal'];

  for (const name of familyNames) {
    describe(name, () => {
      const bundle = bundles[name as keyof typeof bundles];

      it('has correct family name', () => {
        expect(bundle.family).toBe(name);
      });

      it('scene.dark and scene.light are valid SceneThemes', () => {
        expect(bundle.scene.dark.colorMode).toBe('dark');
        expect(bundle.scene.light.colorMode).toBe('light');
      });

      it('diagram.dark and diagram.light exist', () => {
        expect(bundle.diagram.dark).toBeDefined();
        expect(bundle.diagram.light).toBeDefined();
      });

      it('chart.dark and chart.light exist', () => {
        expect(bundle.chart.dark).toBeDefined();
        expect(bundle.chart.light).toBeDefined();
      });

      it('diagram slices have sceneTheme pre-wired', () => {
        expect(bundle.diagram.dark.sceneTheme).toBe(bundle.scene.dark);
        expect(bundle.diagram.light.sceneTheme).toBe(bundle.scene.light);
      });

      it('chart slices have sceneTheme pre-wired', () => {
        expect(bundle.chart.dark.sceneTheme).toBe(bundle.scene.dark);
        expect(bundle.chart.light.sceneTheme).toBe(bundle.scene.light);
      });
    });
  }
});
```

**`packages/themes/src/__tests__/merge.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { mergeThemeBundle } from '../merge';
import { darkGlassBundle } from '../bundles/darkGlass';

describe('mergeThemeBundle', () => {
  it('returns a new bundle without mutating the original', () => {
    const original = darkGlassBundle.scene.dark.background?.fill;
    const merged = mergeThemeBundle(darkGlassBundle, {
      scene: { dark: { background: { fill: { kind: 'color', value: '#ff0000' } } } },
    });
    expect(merged.scene.dark.background?.fill).toEqual({ kind: 'color', value: '#ff0000' });
    expect(darkGlassBundle.scene.dark.background?.fill).toEqual(original); // not mutated
  });

  it('light polarity is unchanged when only dark is overridden', () => {
    const merged = mergeThemeBundle(darkGlassBundle, {
      scene: { dark: { colorMode: 'dark' } },
    });
    expect(merged.scene.light).toBe(darkGlassBundle.scene.light);
  });

  it('preserves family', () => {
    const merged = mergeThemeBundle(darkGlassBundle, {});
    expect(merged.family).toBe('darkGlass');
  });
});
```

### Tests that need `SceneSnapshotContext` construction updated

Every test file in `packages/core/src/` and `packages/diagram/src/` that constructs a `SceneSnapshotContext` directly (usually via a `makeContext()` helper or inline object literal) must add `themeFamily: 'default'` and `themePolarity: 'dark'` to the object:

Search pattern: `sceneIndex:` in `*.test.ts` / `*.test.tsx` files. Files include:
- `packages/core/src/compiler/__tests__/sceneDslCompiler.test.tsx`
- `packages/core/src/compiler/__tests__/viewHandlers.test.tsx`
- `packages/core/src/compiler/__tests__/sceneViewConstraint.test.tsx`
- `packages/core/src/compiler/__tests__/registry.test.ts`
- `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`

---

## 8. PRD Update Requirements

The following PRDs reference the old theme API and must be updated to reflect the new system:

### Must update

**`requirements/core/prd/prd_theming.md`**
- Replace all references to `ThemeKeyContext`, `useThemeKey`, `ThemeKey` with `ActiveTheme` and `SceneEngine.theme`.
- Replace `'enterprise'` in `ThemeFamily` with `'default'`.
- Add `ActiveTheme` interface definition.
- Add `sceneThemeRegistry` as part of the core theme module.
- Add `@brewsite/themes` as the theme data package.
- Remove `SCENE_THEME_PAIRS` from the public API description (it stays as internal/deprecated).

**`requirements/charts/prd/prd_theming.md`**
- Remove `BaseChartDSL.theme` and `BaseChartDSL.sceneTheme` from the API surface.
- Remove `CHART_THEME_PAIRS` from the public API.
- Add `chartThemeRegistry` as the internal resolution mechanism.
- Add `@brewsite/themes` as the source of truth for named family presets.

**`requirements/diagram/prd/prd_theming.md`**
- Remove `DiagramProps.theme` from the DSL surface.
- Remove `DIAGRAM_THEME_PAIRS` from the public API.
- Add `themeRegistry` as the internal resolution mechanism.
- Add `@brewsite/themes` as the source of truth.

**`requirements/core/prd/prd_scene_authoring.md`**
- If it documents `<Scene>` authoring and mentions `theme=` props anywhere, remove them.
- Update any `SceneSnapshotContext` type documentation to include `themeFamily` and `themePolarity`.

**`requirements/core/prd/prd_compiler.md`**
- Update `SceneSnapshotContext` type reference to include new fields.
- Update `CompileApi` documentation if it documents `context` shape.

### New PRD to create

**`requirements/themes/prd/prd_themes-package.md`**

A new PRD for `@brewsite/themes` covering:
- Package purpose and scope
- `ThemeBundle` type
- `themesPlugin` API
- `themes.*` active theme selectors
- `bundles.*` raw bundle access
- `mergeThemeBundle` API
- Dependency graph
- Bundle size characteristics

---

## 9. Handling the `DiagramThemeName` and `ChartThemeName` Type Aliases

Both `DiagramThemeName` and `ChartThemeName` are currently defined as `type DiagramThemeName = ThemeFamily` / `type ChartThemeName = ThemeFamily`. After this change, `ThemeFamily` no longer contains `'enterprise'`. These type aliases remain but now reflect the new `ThemeFamily` values. No change to the alias itself is needed — they inherit the change automatically.

However, any runtime code that hard-codes the string `'enterprise'` must be updated:
- `packages/diagram/src/elements/diagram/compile.ts`: The `resolveTheme` function's fallback path and `DIAGRAM_THEMES` lookup — both go away since theme is no longer on the DSL.
- `packages/charts/src/themes/resolveTheme.ts`: The `FULL_THEME_MAP` entries for `'enterprise'` and `'enterpriseLight'` should be removed (or the keys renamed to `'default'` and `'defaultLight'` if any internal callers still exist).
- `packages/charts/src/themes/createChartTheme.ts`: The `PRESET_MAP` still maps `ThemeFamily` names to presets. Replace the `enterprise` entry with a `default` entry: `default: enterpriseChartTheme`.

---

## 10. Handling `useThemeKey` / `ThemeKeyContext` Removal

`ThemeKeyContext` and `useThemeKey` currently serve as the runtime React context for the active theme family. After this change, the theme is resolved at compile time (via `SceneSnapshotContext`) rather than at render time (via React context). The React context path is no longer needed for element rendering.

However, some consumer code in `apps/examples` may use `useThemeKey()` to drive non-element React UI (e.g., CSS variable injection, HUD colors). These callsites should be migrated to read the `ActiveTheme` from a page-level prop or from a new lightweight React context if needed.

For the purpose of this plan:
1. Keep `ThemeKeyContext` and `useThemeKey` exported but marked `@deprecated` in `packages/core/src/theme/ThemeKeyContext.ts`.
2. `SceneEngine.tsx` no longer provides `ThemeKeyContext.Provider` in its render tree.
3. Any `apps/examples` file using `useThemeKey()` must be updated to get the theme from the widgetSetup return value instead.

---

## 11. Diagram `sceneTheme` Field Implications

`DiagramTheme.sceneTheme` is an optional field on `DiagramTheme`. After the bundle wiring in `@brewsite/themes`, the bundle files set `sceneTheme` on the diagram dark/light objects at bundle assembly time. This means every `DiagramTheme` object inside a registered bundle will have `sceneTheme` populated.

The `DiagramTheme.sceneTheme` field itself is NOT removed from the type — it is still used by `buildThemeRenderConfig` in `packages/diagram/src/elements/diagram/compiler/themeResolver.ts` to derive `fontUrl` and size factors. No changes to `themeResolver.ts` are needed.

---

## 12. Chart Compile Handler Integration

The chart compile handler (find via `grep -r 'BaseChartDSL\|resolveChartTheme' packages/charts/src/` — it is likely in `packages/charts/src/elements/chart/compiler.ts` or a similar file) currently reads `dsl.theme` and calls `resolveChartTheme(dsl.theme)` to get the concrete `ChartTheme`. After `BaseChartDSL.theme` is removed:

```typescript
// Before
import { resolveChartTheme } from '../../themes/resolveTheme';
const chartTheme = resolveChartTheme(dsl.theme ?? 'darkGlass');

// After
import { resolveChartTheme } from '../../themes/chartThemeRegistry';
const chartTheme = resolveChartTheme(api.context.themeFamily, api.context.themePolarity);
```

The chart compile handler must receive `api.context` — confirm it already has `api: CompileApi` in scope. Since all NodeHandlers receive `(node, api, helpers)`, this is already available.

---

## 13. `apps/examples` Scene Files — Full Search Pattern

After all widgetSetup and Page files are updated, run the following greps to find remaining callsites in scene files:

```bash
# Find remaining theme= props in scene DSL
grep -r 'theme={' apps/examples/src --include="*.tsx" | grep -v '.test.'

# Find remaining DIAGRAM_THEME_PAIRS / CHART_THEME_PAIRS imports
grep -r 'DIAGRAM_THEME_PAIRS\|CHART_THEME_PAIRS\|SCENE_THEME_PAIRS' apps/examples/src

# Find remaining useThemeKey callsites
grep -r 'useThemeKey\|ThemeKeyContext' apps/examples/src

# Find remaining enterprise ThemeFamily references
grep -r "'enterprise'" apps/examples/src
```

Each result must be addressed before the migration is complete.

---

## 14. Workspace `pnpm add` Command

After creating `packages/themes/package.json`, the bot must run:

```bash
pnpm install
```

from the workspace root to register `@brewsite/themes` in the workspace and create the symlinks. This is necessary before any `import ... from '@brewsite/themes'` will resolve in `apps/examples`.

---

## 15. Code Style and Module Boundary Rules

- All new files in `packages/themes/src/` are pure TypeScript — no React, no Three.js, no JSX.
- `packages/themes/src/plugin.ts` imports from `@brewsite/core`, `@brewsite/diagram`, `@brewsite/charts` only for their `register*ThemePair` functions and concrete theme types.
- Registry modules (`sceneThemeRegistry.ts`, `themeRegistry.ts`, `chartThemeRegistry.ts`) are module-scoped singletons. They execute at import time. This is intentional — registries must be available synchronously before any compilation runs.
- No circular imports. The dependency direction is strictly:
  `@brewsite/themes` → `@brewsite/diagram`, `@brewsite/charts`, `@brewsite/core`
  `@brewsite/diagram` → `@brewsite/core`
  `@brewsite/charts` → `@brewsite/core`
  `@brewsite/core` → nothing

---

## 16. Summary of Type Changes by Package

### `@brewsite/core` public exports

| Symbol | Before | After |
|--------|--------|-------|
| `ThemeFamily` | Union including `'enterprise'` | Union with `'default'`, no `'enterprise'` |
| `ActiveTheme` | Does not exist | `{ family: ThemeFamily; polarity: 'dark' \| 'light' }` |
| `registerSceneThemePair` | Does not exist | `(family, pair) => void` |
| `resolveSceneTheme` | Does not exist | `(family, polarity) => SceneTheme` |
| `SCENE_THEME_PAIRS` | Exported, 6 entries | Stays exported (deprecated), 6 entries including `default` |
| `ThemeKeyContext` | Exported | Deprecated, kept |
| `useThemeKey` | Exported | Deprecated, kept |
| `ThemeKey` | Exported | Deprecated, kept |
| `SceneThemePair` | Exported from `types.ts` | Removed from public exports (internal to registry) |
| `SpotlightRigTheme` | Exported | Not exported (type is `@internal`) |
| `mergeSpotlightRigTheme` | Exported | Removed |
| `moviePremiereTheme` | Exported | Deprecated alias; `moviePremierePreset` is the new export |
| `concertStageTheme` | Exported | Deprecated alias; `concertStagePreset` is the new export |
| `SpotlightRigPreset` | Does not exist | Exported (type alias for scalar fields) |
| `spotlightDarkGlassTheme` | Exported | Removed |
| `spotlightEnterpriseTheme` | Exported | Removed |
| `spotlightNeonCyberTheme` | Exported | Removed |
| `spotlightLightMinimalTheme` | Exported | Removed |

### `@brewsite/diagram` public exports

| Symbol | Before | After |
|--------|--------|-------|
| `DiagramProps.theme` | Exists | Removed |
| `DIAGRAM_THEMES` | Exported | Removed |
| `DIAGRAM_THEME_PAIRS` | Exported | Removed |
| `registerDiagramThemePair` | Does not exist | Exported |
| `resolveDiagramTheme` | Does not exist | Exported |

### `@brewsite/charts` public exports

| Symbol | Before | After |
|--------|--------|-------|
| `BaseChartDSL.theme` | Exists | Removed |
| `BaseChartDSL.sceneTheme` | Exists | Removed |
| `CHART_THEMES` | Exported | Removed |
| `CHART_THEME_PAIRS` | Exported | Removed |
| `registerChartThemePair` | Does not exist | Exported |
| `resolveChartTheme` (registry) | Does not exist | Exported (new signature) |

### `@brewsite/themes` public surface

| Symbol | Description |
|--------|-------------|
| `themesPlugin(bundles?)` | `WidgetPlugin` factory |
| `ThemeBundle` | Type |
| `ThemeBundleOverrides` | Type |
| `bundles.darkGlass` | `ThemeBundle` |
| `bundles.midnight` | `ThemeBundle` |
| `bundles.neonCyber` | `ThemeBundle` |
| `bundles.lightCanvas` | `ThemeBundle` |
| `bundles.lightMinimal` | `ThemeBundle` |
| `themes.darkGlass.dark` | `ActiveTheme` |
| `themes.darkGlass.light` | `ActiveTheme` |
| (same pattern for all families) | |
| `themes.defaultTheme.dark` | `ActiveTheme` |
| `themes.defaultTheme.light` | `ActiveTheme` |
| `mergeThemeBundle(base, overrides)` | `ThemeBundle` |
