---
title: Implementation Plan — @brewsite/docs Package
doc_type: plan
owner: architecture
status: draft
updated: 2026-03-05
---

# Implementation Plan — @brewsite/docs Package

## Overview

This plan specifies the creation of `packages/docs` as the `@brewsite/docs` reusable library, and the full migration of the `docs/` app from its current React Router route-based architecture to the continuous-scroll `<DocsApp>` model.

**Scope:**
1. Create `packages/docs/src/` — the library package
2. Migrate `docs/` — the docs app becomes the first (and only) consumer

**Not in scope:** SSR, mobile touch scroll, Docusaurus integration, cinematic experience track.

**Key constraint:** `@brewsite/docs` may import from `@brewsite/core`. It must NOT import from `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts`.

---

## Current State

The `docs/` directory at the repository root is the docs app (`package.json` name: `@brewsite/docs`, `private: true`). It uses:
- React Router v7 with `<Routes>` + lazy imports
- Route-based nav (`core-nav.ts`, `diagram-nav.ts`)
- `DocLayout` (React Router `<Outlet>` layout)
- `DocSidebar` (NavLink-based sidebar)
- `DemoScene` wrapper (EngineProvider + progress controls)
- `LiveDemo` (DemoScene + CodeBlock)

After migration, the `docs/` app is renamed to `@brewsite/docs-app` (package.json name change) to avoid a naming conflict with the new `packages/docs` library which takes the `@brewsite/docs` name.

---

## Package: `packages/docs/`

### `packages/docs/package.json`

```json
{
  "name": "@brewsite/docs",
  "version": "0.1.0",
  "private": true,
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
  "files": ["dist"],
  "scripts": {
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "prism-react-renderer": "^2.4.1"
  },
  "peerDependencies": {
    "react": "^19",
    "react-dom": "^19",
    "@brewsite/core": "workspace:*"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitest/coverage-v8": "^2.1.9",
    "jsdom": "^24.0.0",
    "typescript": "^5.9.3",
    "vitest": "^2.1.9"
  }
}
```

`prism-react-renderer` is a regular dependency (not peer) because `CodeBlock` is an internal implementation detail — consumers must not install it separately.

`three` is NOT listed as a peer. `@brewsite/docs` has no direct Three.js imports; Three.js is accessed only transitively through `@brewsite/core`.

### `packages/docs/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "noEmit": true,
    "skipLibCheck": true,
    "paths": {
      "@brewsite/core": ["../core/src/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/docs/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "sourceMap": false,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@brewsite/core": ["../core/dist/index.d.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### `packages/docs/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
```

---

## Source File Specifications

### `packages/docs/src/nav/types.ts`

Single responsibility: nav manifest interface contracts and `defineDocsNav` factory.

```typescript
// Nav manifest interface contracts for @brewsite/docs.

/**
 * A single navigation entry corresponding to exactly one <Section> in page content.
 * The `id` field must match the `id` prop on the corresponding Section component.
 */
export interface DocsNavSection {
  /** Section anchor id. Must match the <Section id="..."> prop. */
  readonly id: string;
  /** Display label shown in the sidebar. */
  readonly label: string;
}

/**
 * A group of related nav entries displayed under a shared header in the sidebar.
 */
export interface DocsNavGroup {
  /** Group header text displayed in the sidebar. */
  readonly title: string;
  /** Ordered list of section entries belonging to this group. */
  readonly sections: readonly DocsNavSection[];
}

/**
 * The fully typed nav manifest returned by defineDocsNav().
 * TId is the union of all section ids derived from the input literal.
 */
export interface DocsNav<TId extends string = string> {
  /** All nav groups in display order. */
  readonly groups: readonly DocsNavGroup[];
  /**
   * All section ids in order (flattened from groups).
   * Used by DocsApp to coordinate IntersectionObserver registration.
   */
  readonly allSectionIds: readonly TId[];
}
```

### `packages/docs/src/nav/defineDocsNav.ts`

Single responsibility: TypeScript factory that derives the `SectionId` union type from a const literal.

```typescript
// Factory for type-safe docs navigation manifests.

import type { DocsNav, DocsNavGroup } from './types';

type NavInputGroup = {
  readonly title: string;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly label: string }>;
};

type ExtractSectionIds<T extends ReadonlyArray<NavInputGroup>> =
  T[number]['sections'][number]['id'];

/**
 * Creates a typed nav manifest from a const-inferred array literal.
 *
 * Returns:
 * - `docsNav`: the DocsNav<TId> manifest for use with DocsApp
 * - `SectionId`: a phantom type witness — use only as:
 *     `export type SectionId = typeof navDef.SectionId;`
 *   Never access the value at runtime.
 *
 * @example
 * ```typescript
 * const navDef = defineDocsNav([
 *   { title: 'Getting Started', sections: [
 *     { id: 'installation', label: 'Installation' },
 *   ]},
 * ] as const);
 * export const docsNav = navDef.docsNav;
 * export type SectionId = typeof navDef.SectionId;
 * ```
 */
export function defineDocsNav<const T extends ReadonlyArray<NavInputGroup>>(
  groups: T,
): {
  docsNav: DocsNav<ExtractSectionIds<T>>;
  /** Phantom type witness — do not access the value. Use typeof for type extraction. */
  SectionId: ExtractSectionIds<T>;
} {
  const allSectionIds = groups.flatMap((g) => g.sections.map((s) => s.id));
  return {
    docsNav: {
      groups: groups as readonly DocsNavGroup[],
      allSectionIds: allSectionIds as ExtractSectionIds<T>[],
    },
    SectionId: undefined as unknown as ExtractSectionIds<T>,
  };
}
```

**Note on `const T extends`:** Requires TypeScript 5.0+. This monorepo uses TypeScript 5.9.3. The `const` modifier on the type parameter causes TypeScript to infer the narrowest literal type from the input without requiring `as const` at the call site (though `as const` still works and is the documented pattern).

### `packages/docs/src/section/Section.tsx`

Single responsibility: typed layout primitive that renders a navigable section anchor.

```typescript
// Typed layout primitive — renders a <section> anchor with id and data-section-id.

import type { ReactElement, ReactNode } from 'react';

/**
 * Props for Section. TId is typed as SectionId from the nav manifest.
 * A mismatch between `id` and the manifest's section ids is a TypeScript compile error.
 */
export interface SectionProps<TId extends string = string> {
  /**
   * Section id. Must match a DocsNavSection.id in the active nav manifest.
   * Typed as SectionId from the manifest so mismatches are compile errors.
   */
  id: TId;
  /**
   * Rendered as <h2> immediately after the section anchor.
   * Omit to suppress the heading (useful for sections that provide their own heading markup).
   */
  title?: string;
  children: ReactNode;
}

/**
 * Layout primitive for a docs section.
 *
 * Renders a <section> element with:
 * - `id` attribute: enables #anchor linking and hash navigation
 * - `data-section-id` attribute: IntersectionObserver target for active-section tracking
 * - Optional <h2> heading from `title` prop
 * - children rendered directly (no scroll, no engine, no special behavior)
 *
 * Section is a dumb presentational component. It does no dynamic registration.
 * Active-section tracking is driven entirely by DocsApp's IntersectionObserver.
 */
export function Section<TId extends string = string>({
  id,
  title,
  children,
}: SectionProps<TId>): ReactElement {
  return (
    <section id={id} data-section-id={id}>
      {title !== undefined ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
```

### `packages/docs/src/demo/normalizeDelta.ts`

Single responsibility: pure delta normalization across WheelEvent deltaMode values.

```typescript
// Pure wheel delta normalization for cross-browser consistency.

/** Assumed CSS line-height in pixels (standard cross-browser assumption). */
const LINE_HEIGHT_PX = 16;

/** Assumed page height in pixels (reasonable estimate for DOM_DELTA_PAGE). */
const PAGE_HEIGHT_PX = 800;

/**
 * Normalizes a WheelEvent delta to pixels, accounting for deltaMode differences.
 *
 * DOM_DELTA_PIXEL (0): delta is already in pixels — return as-is.
 * DOM_DELTA_LINE  (1): delta is in CSS lines — multiply by LINE_HEIGHT_PX (16).
 * DOM_DELTA_PAGE  (2): delta is in pages — multiply by PAGE_HEIGHT_PX (800).
 *
 * Returns a signed number in pixels. Positive = scroll down. Negative = scroll up.
 */
export function normalizeDelta(event: WheelEvent): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL:
      return event.deltaY;
    case WheelEvent.DOM_DELTA_LINE:
      return event.deltaY * LINE_HEIGHT_PX;
    case WheelEvent.DOM_DELTA_PAGE:
      return event.deltaY * PAGE_HEIGHT_PX;
    default:
      return event.deltaY;
  }
}
```

### `packages/docs/src/demo/DemoCaptureContext.ts`

Single responsibility: private context connecting `DocsDemo` (scroll interception) to `DemoEngine` (progress application).

```typescript
// Private context that wires DocsDemo scroll interception to DemoEngine progress.
// Not exported in packages/docs/src/index.ts — internal implementation detail only.

import { createContext } from 'react';

/**
 * Context value shared between DocsDemo and DemoEngine.
 * DocsDemo provides this context; DemoEngine consumes it.
 *
 * This is a private implementation detail of @brewsite/docs.
 * Demo authors never interact with this context directly.
 */
export interface DemoCaptureContextValue {
  /**
   * Called by DemoEngine on mount to register its `setRawProgress` function.
   * Returns a cleanup function that deregisters on unmount.
   */
  registerEngine: (setRawProgress: (progress: number) => void) => () => void;
  /**
   * Called by WheelCaptureDemo when a wheel delta has been normalized.
   * The DocsDemo accumulates this delta into current progress and calls setRawProgress.
   */
  onWheelDelta: (normalizedDeltaPx: number) => void;
  /**
   * Returns the current demo progress in [0, 1].
   * Used by WheelCaptureDemo for boundary pass-through checks.
   */
  getProgress: () => number;
  /**
   * The scroll budget for this demo in scroll units.
   * 1 scroll unit = 1 normalized pixel of deltaY.
   * Used by DocsDemo to convert normalizedDelta → progress increment.
   */
  readonly scrollUnits: number;
}

export const DemoCaptureContext = createContext<DemoCaptureContextValue | null>(null);
```

### `packages/docs/src/demo/WheelCaptureDemo.tsx`

Single responsibility: mount-aware wheel event interception layer.

```typescript
// Wheel event interception with boundary pass-through and ctrlKey guard.

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { normalizeDelta } from './normalizeDelta';
import type { DemoCaptureContextValue } from './DemoCaptureContext';

interface WheelCaptureDemoProps {
  /** Children rendered inside the interception container. */
  children: ReactNode;
  /** When true, wheel events are intercepted (demo pointer is inside). */
  active: boolean;
  /** Capture context from the parent DocsDemo. */
  captureCtx: DemoCaptureContextValue;
}

/**
 * Wheel event interception container.
 *
 * When `active`, attaches a non-passive `wheel` listener to its container div.
 * Applies three guards before intercepting:
 *
 * 1. ctrlKey guard — browser zoom, never intercept.
 * 2. Boundary pass-through — at progress 0.0 scrolling up: pass through.
 *    At progress 1.0 scrolling down: pass through (momentum bleed-through).
 * 3. Intercept — call captureCtx.onWheelDelta() with the normalized pixel delta.
 *
 * This is a private component; it is not exported from the package index.
 */
export function WheelCaptureDemo({
  children,
  active,
  captureCtx,
}: WheelCaptureDemoProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent): void => {
      // 1. Never intercept Ctrl+Wheel — browser zoom.
      if (event.ctrlKey) return;

      const delta = normalizeDelta(event);
      const progress = captureCtx.getProgress();

      // 2. Boundary pass-through:
      //    At the start (progress 0) scrolling up — let page scroll.
      if (delta < 0 && progress <= 0) return;
      //    At the end (progress 1) scrolling down — let page scroll (momentum bleed).
      if (delta > 0 && progress >= 1) return;

      // 3. Intercept and advance demo progress.
      event.preventDefault();
      captureCtx.onWheelDelta(delta);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [active, captureCtx]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
```

### `packages/docs/src/demo/DocsDemo.tsx`

Single responsibility: lazy-mounting demo container with scroll-capture context and IntersectionObserver lifecycle.

```typescript
// Demo container: lazy-mounts DemoEngine on intersection, captures wheel scroll.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { DemoCaptureContext, type DemoCaptureContextValue } from './DemoCaptureContext';
import { WheelCaptureDemo } from './WheelCaptureDemo';

/**
 * Props for DocsDemo.
 */
export interface DocsDemoProps {
  /**
   * Scroll budget in scroll units (1 unit = 1 normalized pixel of deltaY).
   * Determines how much wheel scrolling advances the demo from 0→1.
   * Required. Recommend 2400 as a default value in author-facing docs.
   */
  scrollUnits: number;
  /**
   * Height of the demo container in the page flow.
   *
   * number → treated as pixels. `height={480}` → CSS `height: 480px`.
   * string → passed directly as a CSS length. `height="100vh"` or `height="50vh"`.
   *
   * REQUIREMENT: Both the placeholder div (when unmounted) and the mounted
   * container receive this exact value. They must render at the same pixel
   * height so hash navigation to sections below the demo lands correctly.
   *
   * SAFE: viewport-relative units (`vh`, `dvh`), fixed pixels (`px`).
   * UNSAFE: `calc()` expressions that depend on sibling layout (e.g., `calc(100% - 60px)`)
   * where `100%` resolves differently in placeholder vs mounted state. Document this
   * constraint clearly in usage examples.
   */
  height: number | string;
  /** Optional title displayed above the demo canvas. */
  title?: string;
  /**
   * Demo content — must include a DemoEngine with its children.
   * Example:
   * ```tsx
   * <DocsDemo scrollUnits={2400} height={480}>
   *   <MyDemo />   // MyDemo wraps DemoEngine
   * </DocsDemo>
   * ```
   */
  children: ReactNode;
}

/**
 * Converts the `height` prop to a CSS value string.
 */
function resolveHeight(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/**
 * Demo wrapper with lazy-mount lifecycle and wheel scroll capture.
 *
 * Lifecycle:
 * - Mounts DemoEngine when demo enters within 2×viewport height (rootMargin '200%').
 * - Unmounts when demo exits beyond 4×viewport height (rootMargin '400%').
 * - This hysteresis prevents WebGL context exhaustion on long pages.
 *
 * Re-mount behavior:
 * - Demo restarts from scratch (model loading, shader compilation).
 * - Brief blank canvas is acceptable; no loading spinner is shown.
 * - The placeholder div maintains identical height, preserving hash navigation.
 *
 * Scroll capture:
 * - When the pointer is inside the demo, wheel events advance demo progress.
 * - Ctrl+Wheel is never intercepted (browser zoom).
 * - At progress 0 scrolling up or progress 1 scrolling down, events pass through.
 */
export function DocsDemo({
  scrollUnits,
  height,
  title,
  children,
}: DocsDemoProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Imperative progress accumulator — avoids React re-render on every wheel tick.
  const progressRef = useRef(0);
  const setRawProgressRef = useRef<((p: number) => void) | null>(null);

  // ── IntersectionObserver lifecycle ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Mount observer: element enters within ~2 viewport-heights.
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsMounted(true);
      },
      { rootMargin: '200% 0px 200% 0px', threshold: 0 },
    );

    // Unmount observer: element exits beyond ~4 viewport-heights.
    const unmountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry && !entry.isIntersecting) setIsMounted(false);
      },
      { rootMargin: '400% 0px 400% 0px', threshold: 0 },
    );

    mountObserver.observe(el);
    unmountObserver.observe(el);
    return () => {
      mountObserver.disconnect();
      unmountObserver.disconnect();
    };
  }, []);

  // ── DemoCaptureContext value ───────────────────────────────────────────────
  const captureCtx: DemoCaptureContextValue = useMemo(
    () => ({
      registerEngine: (setRawProgress) => {
        setRawProgressRef.current = setRawProgress;
        return () => {
          setRawProgressRef.current = null;
        };
      },
      onWheelDelta: (normalizedDeltaPx) => {
        const increment = normalizedDeltaPx / scrollUnits;
        const next = Math.max(0, Math.min(1, progressRef.current + increment));
        progressRef.current = next;
        setRawProgressRef.current?.(next);
      },
      getProgress: () => progressRef.current,
      scrollUnits,
    }),
    [scrollUnits],
  );

  const heightCss = resolveHeight(height);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: heightCss,
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    margin: '20px 0',
    background: 'var(--bg-demo, #0a0a10)',
    boxShadow: 'var(--shadow-demo, 0 4px 32px rgba(0,0,0,0.5))',
  };

  const placeholderStyle: CSSProperties = {
    width: '100%',
    height: heightCss,
    // Identical height to containerStyle — required for hash navigation correctness.
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {title !== undefined && (
        <p className="docs-demo__title" style={{ marginBottom: 8, opacity: 0.7, fontSize: 13 }}>
          {title}
        </p>
      )}
      <DemoCaptureContext.Provider value={captureCtx}>
        {isMounted ? (
          <WheelCaptureDemo active={isHovered} captureCtx={captureCtx}>
            <div style={containerStyle}>{children}</div>
          </WheelCaptureDemo>
        ) : (
          // Placeholder maintains identical height for correct hash navigation.
          <div style={placeholderStyle} aria-hidden="true" />
        )}
      </DemoCaptureContext.Provider>
    </div>
  );
}
```

**Design note:** `progressRef` and `setRawProgressRef` are mutable refs, not state. Wheel delta accumulation is imperative to avoid triggering React re-renders on every wheel event (which would be expensive at 60fps scroll velocity). The `DemoCaptureContextValue` object is memoized with `useMemo([scrollUnits])` so `DemoEngine` (which reads it via `useContext`) does not re-register on every parent render.

### `packages/docs/src/demo/DemoEngine.tsx`

Single responsibility: `EngineProvider` wrapper that integrates with `DemoCaptureContext` and forces direct input mode.

```typescript
// EngineProvider wrapper for docs demos — integrates with DemoCaptureContext.

import React, {
  useContext,
  useEffect,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  EngineProvider,
  type EngineProviderProps,
  useSceneEngineContext,
  InputController,
  Scene as SceneDsl,
} from '@brewsite/core';
import { DemoCaptureContext } from './DemoCaptureContext';

/**
 * Props for DemoEngine.
 *
 * Accepts all EngineProvider props except:
 * - `id` — assigned automatically via useId()
 * - `scrollHeightPx` — irrelevant; demos use direct setRawProgress
 *
 * Every other EngineProvider prop (plugins, quality, manifestUrl, sceneTheme, etc.)
 * is forwarded directly.
 *
 * **Do NOT include `<EngineInputRegion>` or `<EngineScrollRegion>` in demo children.**
 * DemoEngine manages progress via wheel capture from the parent DocsDemo.
 * Including these components would conflict with the wheel-capture model.
 */
export type DemoEngineProps = Omit<EngineProviderProps, 'id' | 'scrollHeightPx'> & {
  children: ReactNode;
};

/**
 * Injects an empty <InputController> into the first <Scene> child.
 *
 * This is required to force the engine into "direct" input mode, where
 * progress is managed via setRawProgress rather than window.scrollY.
 * Without this injection, the engine creates a tall scroll spacer and calls
 * window.scrollTo() on every progress update, which hijacks the docs page scroll.
 *
 * `inputModePolicy="prefer-direct"` alone is NOT sufficient — it only returns
 * "direct" when hasSceneInputController is true (useSceneEngine.ts). The
 * InputController injection is what actually satisfies that condition.
 */
function injectDirectMode(children: ReactNode): ReactNode {
  let injected = false;
  return React.Children.map(children, (child) => {
    if (
      !injected &&
      React.isValidElement(child) &&
      (child as React.ReactElement).type === (SceneDsl as React.ComponentType)
    ) {
      injected = true;
      const el = child as React.ReactElement<{ children?: ReactNode }>;
      const existing = el.props.children;
      const existingArray = existing
        ? Array.isArray(existing) ? existing : [existing]
        : [];
      return React.cloneElement(el, undefined, ...existingArray, <InputController key="__dm_direct__" />);
    }
    return child;
  });
}

/**
 * Inner component rendered inside EngineProvider.
 * Reads useSceneEngineContext() and registers setRawProgress with DemoCaptureContext.
 * Renders null — no DOM output.
 */
function DemoEngineRegistrar(): null {
  const { setRawProgress } = useSceneEngineContext();
  const captureCtx = useContext(DemoCaptureContext);

  useEffect(() => {
    if (!captureCtx) return;
    const cleanup = captureCtx.registerEngine(setRawProgress);
    return cleanup;
  }, [captureCtx, setRawProgress]);

  return null;
}

/**
 * Drop-in EngineProvider for docs demos.
 *
 * Usage:
 * ```tsx
 * export function MyDemo() {
 *   return (
 *     <DemoEngine plugins={[corePlugin()]} manifestUrl="/scene-manifest.json">
 *       <Scene id="s1">...</Scene>
 *       <SceneCanvas style={{ width: '100%', height: '100%' }} />
 *       <EngineOverlayHost />
 *     </DemoEngine>
 *   );
 * }
 * ```
 *
 * Place MyDemo inside <DocsDemo scrollUnits={2400} height={480}>:
 * ```tsx
 * <DocsDemo scrollUnits={2400} height={480}>
 *   <MyDemo />
 * </DocsDemo>
 * ```
 *
 * Progress is driven by wheel scroll over the DocsDemo region.
 * DemoEngine automatically injects <InputController> into the first <Scene>
 * child to force the engine into direct mode (no scroll spacer, no
 * window.scrollY mapping). Do NOT add <EngineInputRegion> or <EngineScrollRegion>
 * to demo children — they conflict with the wheel-capture model.
 */
export function DemoEngine({ children, ...rest }: DemoEngineProps): ReactElement {
  // Stable auto-generated id. Stable across re-renders; unique per demo instance.
  const autoId = useId();

  // Inject <InputController> into the first <Scene> to force direct mode.
  // See injectDirectMode() for why this is required over inputModePolicy alone.
  const directModeChildren = injectDirectMode(children);

  return (
    <EngineProvider {...rest} id={autoId}>
      {directModeChildren}
      {/* DemoEngineRegistrar must be inside EngineProvider to read its context. */}
      <DemoEngineRegistrar />
    </EngineProvider>
  );
}
```

**Critical design note:** Direct mode requires an `<InputController>` inside a `<Scene>`. `inputModePolicy="prefer-direct"` alone is NOT sufficient — `useSceneEngine.ts` returns `'direct'` for `prefer-direct` only when `hasSceneInputController` is true. `DemoEngine` injects an empty `<InputController>` into the first `<Scene>` child to satisfy this condition. This is the same mechanism used by the existing `DemoScene.injectDirectMode()`. The `scrollHeightPx` prop is excluded from `DemoEngineProps` because it is meaningless in direct mode.

### `packages/docs/src/layout/DocsApp.tsx`

Single responsibility: root layout providing sidebar + continuous scroll region, with IntersectionObserver for active-section tracking.

```typescript
// Root layout: sidebar + scroll content region + IntersectionObserver coordination.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { DocsNav } from '../nav/types';
import { DocsSidebar } from './DocsSidebar';
import { DocsScrollRegion } from './DocsScrollRegion';

/** Context provided to all descendants — allows reading the active section id. */
interface DocsAppContextValue {
  readonly activeId: string;
}

export const DocsAppContext = createContext<DocsAppContextValue>({ activeId: '' });

export interface DocsAppProps {
  /**
   * The nav manifest produced by defineDocsNav().
   * The sidebar renders from this manifest. Section intersection tracking
   * uses allSectionIds to register the IntersectionObserver.
   */
  nav: DocsNav<string>;
  /**
   * All page content as children. Must contain <Section> elements
   * (or components that render them). Mounts eagerly in a single
   * scrollable div — no lazy loading.
   */
  children: ReactNode;
}

/**
 * Root docs layout component.
 *
 * Layout: CSS Grid with a fixed-width sidebar column and a scroll content column.
 * The scroll region fills the remaining width and has `overflow-y: auto`.
 *
 * Active section tracking:
 * - Mounts one IntersectionObserver watching all [data-section-id] elements.
 * - rootMargin: '-10% 0px -80% 0px' approximates "section is at top of viewport".
 * - The last intersecting section becomes activeId.
 *
 * Hash navigation on initial load:
 * - Reads window.location.hash on mount.
 * - setTimeout(0) defers scroll until after first paint.
 * - scrollIntoView({ behavior: 'instant' }) lands at the element.
 * - Works correctly because all Section elements and DocsDemo placeholder divs
 *   mount eagerly with stable heights.
 *
 * URL hash update:
 * - Updates window.location.hash whenever activeId changes (via replaceState).
 */
export function DocsApp({ nav, children }: DocsAppProps): ReactElement {
  const [activeId, setActiveId] = useState<string>('');
  const scrollRegionRef = useRef<HTMLDivElement>(null);

  // ── IntersectionObserver for active section ────────────────────────────────
  useEffect(() => {
    const scrollEl = scrollRegionRef.current;
    if (!scrollEl) return;

    // Observe all [data-section-id] elements within the scroll region.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section-id') ?? '';
            if (id) setActiveId(id);
          }
        }
      },
      {
        root: scrollEl,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      },
    );

    const targets = scrollEl.querySelectorAll('[data-section-id]');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // Re-register if nav changes (nav is static in practice, but defensive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // ── Hash navigation on initial load ───────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // ── URL hash sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeId) {
      history.replaceState(null, '', `#${activeId}`);
    }
  }, [activeId]);

  // ── Sidebar scroll-to handler ──────────────────────────────────────────────
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const layoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-width, 260px) 1fr',
    minHeight: '100vh',
    background: 'var(--bg-page, #0d0d12)',
  };

  return (
    <DocsAppContext.Provider value={{ activeId }}>
      <div style={layoutStyle}>
        <DocsSidebar
          nav={nav}
          activeId={activeId}
          onSectionClick={scrollToSection}
        />
        <DocsScrollRegion ref={scrollRegionRef}>
          {children}
        </DocsScrollRegion>
      </div>
    </DocsAppContext.Provider>
  );
}
```

**CSS approach:** `DocsApp` uses inline styles for all layout-critical properties (display, grid columns, minHeight). CSS Custom Properties (`--sidebar-width`, `--bg-page`) are used for theming tokens. The `docs/` app defines these tokens in its `variables.css`. The library itself provides fallback values via `var(--token, fallback)` syntax. This means `@brewsite/docs` has zero CSS file output — all visual styling is the consumer's responsibility.

### `packages/docs/src/layout/DocsSidebar.tsx`

Single responsibility: static-manifest sidebar with active-section highlight and click-to-jump.

```typescript
// Static-manifest sidebar — reads from DocsNav and highlights activeId.

import { type ReactElement } from 'react';
import type { DocsNav } from '../nav/types';

export interface DocsSidebarProps {
  nav: DocsNav<string>;
  activeId: string;
  onSectionClick: (id: string) => void;
}

/**
 * Fixed-position sidebar rendered from the static nav manifest.
 *
 * Layout:
 * - `position: sticky; top: 0; height: 100vh; overflow-y: auto` — stays in view on scroll.
 * - Group titles use `.nav-section__title` class.
 * - Section buttons use `.nav-item` class with `.nav-item--active` modifier on match.
 *
 * Active-section highlight:
 * - Compares each section id against `activeId` prop.
 * - Active item receives `aria-current="page"` for accessibility.
 *
 * Click-to-jump:
 * - Calls `onSectionClick(id)` → parent calls `scrollIntoView({ behavior: 'smooth' })`.
 */
export function DocsSidebar({
  nav,
  activeId,
  onSectionClick,
}: DocsSidebarProps): ReactElement {
  return (
    <aside
      className="docs-sidebar"
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        width: 'var(--sidebar-width, 260px)',
        background: 'var(--bg-sidebar, #111117)',
        borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        padding: '24px 0',
        flexShrink: 0,
      }}
    >
      {nav.groups.map((group) => (
        <div key={group.title} className="nav-section">
          <div
            className="nav-section__title"
            style={{
              padding: '4px 20px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #55556a)',
              marginTop: 16,
            }}
          >
            {group.title}
          </div>
          {group.sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`nav-item nav-item--button${isActive ? ' nav-item--active' : ''}`}
                onClick={() => onSectionClick(section.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 20px',
                  fontSize: 14,
                  color: isActive
                    ? 'var(--text-primary, #e4e4f0)'
                    : 'var(--text-secondary, #8888aa)',
                  background: isActive ? 'var(--bg-elevated, #1e1e28)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderLeft: isActive
                    ? '2px solid var(--accent-blue, #4d9fff)'
                    : '2px solid transparent',
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
```

### `packages/docs/src/layout/DocsScrollRegion.tsx`

Single responsibility: the single scrollable content column.

```typescript
// Continuous scroll content region.

import { forwardRef, type ReactNode, type ReactElement } from 'react';

interface DocsScrollRegionProps {
  children: ReactNode;
}

/**
 * The scrollable content column in the DocsApp layout.
 *
 * Renders a div with `overflow-y: auto; height: 100vh` so the content
 * column scrolls independently of the sidebar. The ref is forwarded to
 * DocsApp for IntersectionObserver registration (`root: scrollEl`).
 *
 * Content is padded and max-width constrained for readability:
 * - max-width: var(--content-max-width, 820px)
 * - padding: 48px 48px on wide viewports
 */
export const DocsScrollRegion = forwardRef<HTMLDivElement, DocsScrollRegionProps>(
  ({ children }, ref): ReactElement => {
    return (
      <div
        ref={ref}
        className="docs-scroll-region"
        style={{
          overflowY: 'auto',
          height: '100vh',
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          className="docs-content"
          style={{
            maxWidth: 'var(--content-max-width, 820px)',
            padding: '48px 48px',
            margin: '0 auto',
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

DocsScrollRegion.displayName = 'DocsScrollRegion';
```

### `packages/docs/src/hooks/useActiveSectionId.ts`

Single responsibility: hook to read the active section id from context (optional convenience export).

```typescript
// Convenience hook to read the active section id from DocsApp context.

import { useContext } from 'react';
import { DocsAppContext } from '../layout/DocsApp';

/**
 * Returns the id of the currently active section, as tracked by DocsApp's
 * IntersectionObserver. Returns an empty string if no section is active or
 * if used outside DocsApp.
 *
 * Use this hook in custom sidebar or progress indicator components.
 */
export function useActiveSectionId(): string {
  return useContext(DocsAppContext).activeId;
}
```

### `packages/docs/src/hooks/useDemoProgress.ts`

Single responsibility: read the current progress of a named demo engine for external control.

```typescript
// Hook for reading demo engine progress from the global registry.

import { useSceneEngineState } from '@brewsite/core';

/**
 * Reads the current engine progress for a named demo.
 *
 * Only useful when the DemoEngine was given an explicit `id` prop.
 * For most demos, progress is driven by wheel capture and need not be observed externally.
 *
 * Returns null if the engine is not mounted or the id is not registered.
 */
export function useDemoProgress(engineId: string): number | null {
  const state = useSceneEngineState(engineId);
  return state?.progress ?? null;
}
```

### `packages/docs/src/ui/CodeBlock.tsx`

Migrated directly from `docs/src/components/ui/CodeBlock.tsx`. Updated to use `CopyButton` from the package.

```typescript
// Syntax-highlighted code block with copy button. Uses prism-react-renderer.

import { type ReactElement } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CopyButton } from './CopyButton';

/** Supported syntax highlighting languages. Extend as needed. */
export type CodeLanguage = 'tsx' | 'typescript' | 'bash' | 'json' | 'css';

export interface CodeBlockProps {
  /** The code string to display. Leading/trailing whitespace is trimmed. */
  code: string;
  /** Syntax highlighting language. Defaults to 'typescript'. */
  language?: CodeLanguage;
}

/**
 * Syntax-highlighted code block.
 *
 * Renders a dark code block using prism-react-renderer nightOwl theme.
 * Includes a copy-to-clipboard button in the toolbar.
 *
 * CSS class surface (for consumer styling):
 * - `.code-block` — root wrapper
 * - `.code-block__toolbar` — toolbar row (language label + copy button)
 * - `.code-block__lang` — language label
 */
export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps): ReactElement {
  return (
    <div className="code-block" style={{ borderRadius: 8, overflow: 'hidden', margin: '16px 0' }}>
      <div
        className="code-block__toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'var(--bg-code, #12121a)',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        }}
      >
        <span
          className="code-block__lang"
          style={{ fontSize: 11, color: 'var(--text-muted, #55556a)', fontFamily: 'var(--font-mono)' }}
        >
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className}
            style={{ ...style, margin: 0, padding: '20px', overflowX: 'auto', fontSize: 13 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, j) => (
                  <span key={j} {...getTokenProps({ token })} />
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

### `packages/docs/src/ui/CopyButton.tsx`

Migrated from `docs/src/components/ui/CopyButton.tsx`. No changes to logic.

```typescript
// Copy-to-clipboard button with transient "Copied" feedback state.

import { useState, type ReactElement } from 'react';

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      className="copy-btn"
      type="button"
      onClick={handleCopy}
      style={{
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'transparent',
        color: 'var(--text-secondary, #8888aa)',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}
```

### `packages/docs/src/ui/Callout.tsx`

Migrated from `docs/src/components/ui/Callout.tsx`. Removed emoji — uses CSS class-based icons instead.

```typescript
// Tip / warning / note callout box.

import { type ReactElement, type ReactNode } from 'react';

export type CalloutType = 'note' | 'warning' | 'tip';

export interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
}

const LABEL: Record<CalloutType, string> = {
  note: 'Note',
  warning: 'Warning',
  tip: 'Tip',
};

/**
 * Callout box for note / warning / tip content.
 *
 * CSS class surface:
 * - `.callout` — root
 * - `.callout--note` / `.callout--warning` / `.callout--tip` — type modifier
 * - `.callout__label` — type label (e.g. "Note")
 * - `.callout__body` — content wrapper
 */
export function Callout({ type, children }: CalloutProps): ReactElement {
  return (
    <aside
      className={`callout callout--${type}`}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'var(--bg-elevated, #1e1e28)',
        margin: '16px 0',
      }}
    >
      <span
        className="callout__label"
        style={{ fontWeight: 600, fontSize: 13, flexShrink: 0, color: 'var(--text-secondary, #8888aa)' }}
      >
        {LABEL[type]}
      </span>
      <div className="callout__body">{children}</div>
    </aside>
  );
}
```

### `packages/docs/src/ui/PropTable.tsx`

Migrated from `docs/src/components/ui/PropTable.tsx`. Minimal changes.

```typescript
// API reference table for component/function props.

import { type ReactElement } from 'react';

export interface PropRow {
  /** Prop name. */
  name: string;
  /** TypeScript type string. */
  type: string;
  /** Whether the prop is required. Displays a * marker when true. */
  required?: boolean;
  /** Default value as a string. Omit when there is no default. */
  defaultValue?: string;
  /** Description of the prop's behavior. */
  description: string;
}

interface PropTableProps {
  rows: PropRow[];
}

/**
 * Tabular API reference for component props.
 * CSS class: `.prop-table`
 */
export function PropTable({ rows }: PropTableProps): ReactElement {
  return (
    <table className="prop-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Prop</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Type</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Default</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              <code>{row.name}</code>
              {row.required === true && (
                <span className="prop-table__required" style={{ color: 'var(--accent-orange, #f97316)', marginLeft: 4 }}>*</span>
              )}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              <code style={{ color: 'var(--text-code, #c0c0e0)' }}>{row.type}</code>
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              {row.defaultValue !== undefined ? <code>{row.defaultValue}</code> : <span style={{ color: 'var(--text-muted, #55556a)' }}>—</span>}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              {row.description}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### `packages/docs/src/index.ts`

Public API surface. Only exports consumer-facing symbols. `DemoCaptureContext`, `WheelCaptureDemo`, `DocsAppContext`, `DocsScrollRegion` are internal — not exported.

```typescript
// Public API surface for @brewsite/docs.
// This is the only file consumers should import from.

// ── Nav ───────────────────────────────────────────────────────────────────────
export { defineDocsNav } from './nav/defineDocsNav';
export type { DocsNav, DocsNavGroup, DocsNavSection } from './nav/types';

// ── Layout ────────────────────────────────────────────────────────────────────
export { DocsApp } from './layout/DocsApp';
export type { DocsAppProps } from './layout/DocsApp';

// ── Section ───────────────────────────────────────────────────────────────────
export { Section } from './section/Section';
export type { SectionProps } from './section/Section';

// ── Demo ──────────────────────────────────────────────────────────────────────
export { DocsDemo } from './demo/DocsDemo';
export type { DocsDemoProps } from './demo/DocsDemo';
export { DemoEngine } from './demo/DemoEngine';
export type { DemoEngineProps } from './demo/DemoEngine';

// ── Content primitives ────────────────────────────────────────────────────────
export { CodeBlock } from './ui/CodeBlock';
export type { CodeBlockProps, CodeLanguage } from './ui/CodeBlock';
export { Callout } from './ui/Callout';
export type { CalloutProps, CalloutType } from './ui/Callout';
export { PropTable } from './ui/PropTable';
export type { PropTableProps, PropRow } from './ui/PropTable';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useActiveSectionId } from './hooks/useActiveSectionId';
export { useDemoProgress } from './hooks/useDemoProgress';
```

---

## Tests

All tests live in `packages/docs/src/**/__tests__/` co-located with their modules.

### `packages/docs/src/nav/__tests__/defineDocsNav.test.ts`

Pure function — no mocking.

```typescript
import { describe, it, expect } from 'vitest';
import { defineDocsNav } from '../defineDocsNav';

const NAV_INPUT = [
  {
    title: 'Getting Started',
    sections: [
      { id: 'installation', label: 'Installation' },
      { id: 'quick-start', label: 'Quick Start' },
    ],
  },
  {
    title: 'Reference',
    sections: [
      { id: 'api-reference', label: 'API Reference' },
    ],
  },
] as const;

describe('defineDocsNav', () => {
  it('returns groups in input order', () => {
    const result = defineDocsNav(NAV_INPUT);
    expect(result.docsNav.groups).toHaveLength(2);
    expect(result.docsNav.groups[0]?.title).toBe('Getting Started');
    expect(result.docsNav.groups[1]?.title).toBe('Reference');
  });

  it('returns allSectionIds flattened from all groups in order', () => {
    const result = defineDocsNav(NAV_INPUT);
    expect(result.docsNav.allSectionIds).toEqual([
      'installation',
      'quick-start',
      'api-reference',
    ]);
  });

  it('preserves section labels', () => {
    const result = defineDocsNav(NAV_INPUT);
    const s = result.docsNav.groups[0]?.sections[0];
    expect(s?.id).toBe('installation');
    expect(s?.label).toBe('Installation');
  });

  it('SectionId phantom value is falsy (undefined at runtime)', () => {
    const result = defineDocsNav(NAV_INPUT);
    // TypeScript: typeof result.SectionId is 'installation' | 'quick-start' | 'api-reference'
    // Runtime: value is undefined
    expect(result.SectionId).toBeUndefined();
  });
});
```

### `packages/docs/src/demo/__tests__/normalizeDelta.test.ts`

Pure function — no mocking.

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeDelta } from '../normalizeDelta';

const makeWheelEvent = (deltaY: number, deltaMode: number): WheelEvent =>
  ({ deltaY, deltaMode } as WheelEvent);

describe('normalizeDelta', () => {
  it('returns deltaY unchanged for DOM_DELTA_PIXEL (mode=0)', () => {
    expect(normalizeDelta(makeWheelEvent(120, 0))).toBe(120);
    expect(normalizeDelta(makeWheelEvent(-80, 0))).toBe(-80);
    expect(normalizeDelta(makeWheelEvent(0, 0))).toBe(0);
  });

  it('multiplies by 16 for DOM_DELTA_LINE (mode=1)', () => {
    expect(normalizeDelta(makeWheelEvent(3, 1))).toBe(48);
    expect(normalizeDelta(makeWheelEvent(-1, 1))).toBe(-16);
  });

  it('multiplies by 800 for DOM_DELTA_PAGE (mode=2)', () => {
    expect(normalizeDelta(makeWheelEvent(1, 2))).toBe(800);
    expect(normalizeDelta(makeWheelEvent(-2, 2))).toBe(-1600);
  });

  it('falls back to deltaY for unknown deltaMode', () => {
    expect(normalizeDelta(makeWheelEvent(50, 99))).toBe(50);
  });
});
```

### `packages/docs/src/section/__tests__/Section.test.tsx`

React component — interface-based stateful test (renders real DOM via jsdom).

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Section } from '../Section';

describe('Section', () => {
  it('renders a <section> element with correct id and data-section-id', () => {
    const { container } = render(<Section id="installation" title="Installation">content</Section>);
    const el = container.querySelector('section');
    expect(el).not.toBeNull();
    expect(el?.id).toBe('installation');
    expect(el?.getAttribute('data-section-id')).toBe('installation');
  });

  it('renders <h2> when title is provided', () => {
    const { container } = render(<Section id="foo" title="My Section">content</Section>);
    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('My Section');
  });

  it('does not render <h2> when title is omitted', () => {
    const { container } = render(<Section id="foo">content</Section>);
    expect(container.querySelector('h2')).toBeNull();
  });

  it('renders children inside the section element', () => {
    const { getByText } = render(<Section id="foo">Hello World</Section>);
    expect(getByText('Hello World')).not.toBeNull();
  });
});
```

### `packages/docs/src/demo/__tests__/WheelCaptureDemo.test.tsx`

Interface-based stateful test. Uses real DOM events via jsdom. Tests the contract: wheel events are intercepted or passed through based on context state.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WheelCaptureDemo } from '../WheelCaptureDemo';
import type { DemoCaptureContextValue } from '../DemoCaptureContext';

function makeCaptureCtx(progressValue: number): DemoCaptureContextValue & { onWheelDelta: ReturnType<typeof vi.fn> } {
  return {
    onWheelDelta: vi.fn(),
    registerEngine: vi.fn().mockReturnValue(() => {}),
    getProgress: () => progressValue,
    scrollUnits: 2400,
  };
}

describe('WheelCaptureDemo', () => {
  it('calls onWheelDelta with normalized delta when active and within bounds', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    // jsdom does not support non-passive listeners well; test via direct dispatch.
    const el = container.firstChild as HTMLElement;
    const event = new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(ctx.onWheelDelta).toHaveBeenCalledWith(100);
  });

  it('does NOT call onWheelDelta when active is false', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={false} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('does NOT intercept ctrlKey wheel events (browser zoom)', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('passes through at progress 0 scrolling up (negative delta)', () => {
    const ctx = makeCaptureCtx(0);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('passes through at progress 1 scrolling down (positive delta)', () => {
    const ctx = makeCaptureCtx(1);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('intercepts at progress 1 scrolling up (negative delta)', () => {
    const ctx = makeCaptureCtx(1);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).toHaveBeenCalledWith(-100);
  });
});
```

### `packages/docs/src/demo/__tests__/DocsDemo.test.tsx`

Tests for placeholder height matching and IntersectionObserver lifecycle.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { DocsDemo } from '../DocsDemo';

// jsdom does not implement IntersectionObserver — provide a mock.
let observerCallback: IntersectionObserverCallback | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

const MockIntersectionObserver = vi.fn().mockImplementation(
  (callback: IntersectionObserverCallback) => {
    observerCallback = callback;
    return { observe: mockObserve, disconnect: mockDisconnect };
  }
);

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  observerCallback = null;
});

describe('DocsDemo', () => {
  it('renders placeholder (not children) before mount trigger', () => {
    const { queryByTestId } = render(
      <DocsDemo scrollUnits={2400} height={480}>
        <div data-testid="demo-content">Demo Content</div>
      </DocsDemo>
    );
    // Before IntersectionObserver fires, content should not be mounted.
    expect(queryByTestId('demo-content')).toBeNull();
  });

  it('placeholder div has the same height as the mounted container (number)', () => {
    const { container } = render(
      <DocsDemo scrollUnits={2400} height={480}><div>content</div></DocsDemo>
    );
    const placeholder = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder?.style.height).toBe('480px');
  });

  it('placeholder div has the same height as the mounted container (string)', () => {
    const { container } = render(
      <DocsDemo scrollUnits={2400} height="100vh"><div>content</div></DocsDemo>
    );
    const placeholder = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder?.style.height).toBe('100vh');
  });
});
```

### `packages/docs/src/demo/__tests__/DemoEngine.test.tsx`

Tests that `DemoEngineRegistrar` registers `setRawProgress` with `DemoCaptureContext` on mount and calls the cleanup on unmount. `@brewsite/core` is vi-mocked so Three.js is not invoked in jsdom.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { DemoCaptureContext, type DemoCaptureContextValue } from '../DemoCaptureContext';
import { DemoEngine } from '../DemoEngine';

// Mock @brewsite/core so no Three.js WebGL context is created in jsdom.
// The mock EngineProvider renders children directly; useSceneEngineContext
// returns a stub with a controllable setRawProgress.
const mockSetRawProgress = vi.fn();
vi.mock('@brewsite/core', () => {
  const React = require('react');
  return {
    EngineProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSceneEngineContext: () => ({ setRawProgress: mockSetRawProgress }),
    InputController: () => null,
    Scene: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

function makeCaptureCtx(): DemoCaptureContextValue & {
  registerEngine: ReturnType<typeof vi.fn>;
} {
  const cleanup = vi.fn();
  return {
    registerEngine: vi.fn().mockReturnValue(cleanup),
    onWheelDelta: vi.fn(),
    getProgress: () => 0,
    scrollUnits: 2400,
    _cleanup: cleanup,
  } as unknown as DemoCaptureContextValue & { registerEngine: ReturnType<typeof vi.fn> };
}

describe('DemoEngine', () => {
  beforeEach(() => {
    mockSetRawProgress.mockClear();
  });

  it('calls registerEngine with setRawProgress on mount', () => {
    const ctx = makeCaptureCtx();
    render(
      <DemoCaptureContext.Provider value={ctx}>
        <DemoEngine manifestUrl="/scene-manifest.json">
          {/* No <Scene> children needed for this registration test */}
        </DemoEngine>
      </DemoCaptureContext.Provider>
    );
    expect(ctx.registerEngine).toHaveBeenCalledTimes(1);
    expect(ctx.registerEngine).toHaveBeenCalledWith(mockSetRawProgress);
  });

  it('calls cleanup returned by registerEngine on unmount', () => {
    const ctx = makeCaptureCtx();
    const cleanup = (ctx as unknown as { _cleanup: ReturnType<typeof vi.fn> })._cleanup;
    const { unmount } = render(
      <DemoCaptureContext.Provider value={ctx}>
        <DemoEngine manifestUrl="/scene-manifest.json" />
      </DemoCaptureContext.Provider>
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not call registerEngine when rendered outside DemoCaptureContext', () => {
    const ctx = makeCaptureCtx();
    // No DemoCaptureContext.Provider — context value is null.
    render(<DemoEngine manifestUrl="/scene-manifest.json" />);
    expect(ctx.registerEngine).not.toHaveBeenCalled();
  });
});
```

**Why vi.mock is acceptable here:** `DemoEngine` depends on `EngineProvider` and `useSceneEngineContext` from `@brewsite/core`. These pull in Three.js, which requires a real WebGL context unavailable in jsdom. The mock replaces `EngineProvider` with a passthrough fragment and `useSceneEngineContext` with a controlled stub. The contract being tested is the `DemoEngineRegistrar` registration behavior — not EngineProvider internals. This is a boundary test, not an internal test.

---

### `packages/docs/src/layout/__tests__/DocsApp.test.tsx`

Tests sidebar rendering from nav manifest, initial mount behavior, and active-section highlighting via IntersectionObserver callback.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { DocsApp } from '../DocsApp';
import { defineDocsNav } from '../../nav/defineDocsNav';

// Controllable IntersectionObserver mock — exposes the callback so tests can fire it.
let capturedCallbacks: IntersectionObserverCallback[] = [];
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

const MockIntersectionObserver = vi.fn().mockImplementation(
  (callback: IntersectionObserverCallback) => {
    capturedCallbacks.push(callback);
    return { observe: mockObserve, disconnect: mockDisconnect };
  }
);

beforeEach(() => {
  capturedCallbacks = [];
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const { docsNav } = defineDocsNav([
  { title: 'Getting Started', sections: [
    { id: 'installation', label: 'Installation' },
    { id: 'quick-start',  label: 'Quick Start' },
  ]},
] as const);

describe('DocsApp', () => {
  it('renders sidebar group title from nav manifest', () => {
    const { getByText } = render(<DocsApp nav={docsNav}><div /></DocsApp>);
    expect(getByText('Getting Started')).not.toBeNull();
  });

  it('renders sidebar section labels from nav manifest', () => {
    const { getByText } = render(<DocsApp nav={docsNav}><div /></DocsApp>);
    expect(getByText('Installation')).not.toBeNull();
    expect(getByText('Quick Start')).not.toBeNull();
  });

  it('renders children inside the scroll region', () => {
    const { getByTestId } = render(
      <DocsApp nav={docsNav}><div data-testid="child">content</div></DocsApp>
    );
    expect(getByTestId('child')).not.toBeNull();
  });

  it('marks the active section button with aria-current="page" when IntersectionObserver fires', () => {
    const { container } = render(
      <DocsApp nav={docsNav}>
        <div data-section-id="installation" />
        <div data-section-id="quick-start" />
      </DocsApp>
    );

    // Fire the IntersectionObserver callback with 'installation' as the intersecting entry.
    // DocsApp registers one observer; capturedCallbacks[0] is that observer's callback.
    expect(capturedCallbacks.length).toBeGreaterThan(0);
    const callback = capturedCallbacks[0]!;
    callback(
      [{ isIntersecting: true, target: { getAttribute: () => 'installation' } }] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver
    );

    // The 'Installation' button should now have aria-current="page".
    const installBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Installation'
    );
    expect(installBtn?.getAttribute('aria-current')).toBe('page');

    // The 'Quick Start' button should NOT have aria-current.
    const quickStartBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Quick Start'
    );
    expect(quickStartBtn?.getAttribute('aria-current')).toBeNull();
  });
});
```

---

## Migration: `docs/` App

The root `docs/` directory is the sole consumer of `@brewsite/docs`. This migration happens in one go (no side-by-side period).

### Step 1 — Rename `docs/` package

**File: `docs/package.json`**

Change:
```json
"name": "@brewsite/docs"
```
To:
```json
"name": "@brewsite/docs-app"
```

Add `@brewsite/docs` (the new library) as a workspace dependency:
```json
"dependencies": {
  "@brewsite/core": "workspace:*",
  "@brewsite/docs": "workspace:*"
}
```

Remove `react-router` from dependencies (it is no longer used after migration).

### Step 2 — Delete dead code

Delete the following files from `docs/src/`:

| File | Reason |
|---|---|
| `components/layout/DocLayout.tsx` | React Router `<Outlet>` layout — replaced by `DocsApp` |
| `components/layout/DocSidebar.tsx` | Route-based `<NavLink>` sidebar — replaced by `DocsSidebar` inside `DocsApp` |
| `components/layout/DocHeader.tsx` | Route-based header — no header in new continuous-scroll layout |
| `nav/core-nav.ts` | Route-based nav — replaced by `docs-nav.ts` with `defineDocsNav()` |
| `nav/diagram-nav.ts` | Route-based nav |
| `nav/types.ts` | Route-based nav types — replaced by `DocsNavSection`, `DocsNavGroup` from `@brewsite/docs` |
| `routes.tsx` | React Router routes tree — no longer used |
| `components/demo/LiveDemo.tsx` | `DemoScene` + `CodeBlock` wrapper — replaced by `DocsDemo` + `DemoEngine` |
| `demos/shared/DemoScene.tsx` | EngineProvider + progress controls wrapper — replaced by `DemoEngine` |
| `demos/shared/demoSetup.ts` | Plugin factory used by `DemoScene` — deleted with `DemoScene` |
| `components/ui/CodeBlock.tsx` | Migrated into `@brewsite/docs` — re-export from library instead |
| `components/ui/Callout.tsx` | Migrated into `@brewsite/docs` |
| `components/ui/CopyButton.tsx` | Migrated into `@brewsite/docs` |
| `components/ui/PropTable.tsx` | Migrated into `@brewsite/docs` |
| `components/ui/ThemeToggle.tsx` | Keep (not in scope of this feature) |

### Step 3 — Create `docs/src/docs-nav.ts`

New file. Defines the section-based nav manifest using `defineDocsNav()`.

```typescript
// docs/src/docs-nav.ts
import { defineDocsNav } from '@brewsite/docs';

const navDef = defineDocsNav([
  {
    title: 'Getting Started',
    sections: [
      { id: 'getting-started',  label: 'What is BrewSite Core?' },
      { id: 'installation',     label: 'Installation' },
      { id: 'quick-start',      label: 'Quick Start' },
      { id: 'concepts',         label: 'Core Concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    sections: [
      { id: 'scene-dsl',        label: 'Scene DSL' },
      { id: 'multi-scene',      label: 'Multi-Scene Sequences' },
      { id: 'transitions',      label: 'Transitions & Easing' },
    ],
  },
  {
    title: 'Elements',
    sections: [
      { id: 'model',            label: 'Model' },
      { id: 'camera',           label: 'Camera' },
      { id: 'lighting',         label: 'Lighting' },
      { id: 'background',       label: 'Background' },
      { id: 'environment',      label: 'Environment' },
      { id: 'floor',            label: 'Floor' },
    ],
  },
  {
    title: 'Overlay Content',
    sections: [
      { id: 'hud',              label: 'Scene Overlay' },
      { id: 'hud-animejs',      label: 'Anime.js Presets' },
      { id: 'labels',           label: 'Label System' },
    ],
  },
  {
    title: 'Input',
    sections: [
      { id: 'input-navigation', label: 'Scene Navigation' },
      { id: 'input-actions',    label: 'Input Actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    sections: [
      { id: 'player',           label: 'ScenePlayer & EngineProvider' },
      { id: 'hooks',            label: 'Hooks Reference' },
    ],
  },
  {
    title: 'Widget SDK',
    sections: [
      { id: 'widget-sdk',       label: 'Overview' },
      { id: 'custom-widget',    label: 'Custom Widget' },
      { id: 'variable-store',   label: 'VariableStore' },
      { id: 'widget-registry',  label: 'Widget Registry' },
    ],
  },
  {
    title: 'Reference',
    sections: [
      { id: 'api-reference',    label: 'API Reference' },
      { id: 'timeline',         label: 'Timeline & Math' },
    ],
  },
] as const);

export const docsNav = navDef.docsNav;
export type SectionId = typeof navDef.SectionId;
```

### Step 4 — Rewrite `docs/src/App.tsx`

Replace the React Router `<Routes>` tree with a flat `<DocsApp>` rendering all pages.

```tsx
// docs/src/App.tsx
import type { ReactElement } from 'react';
import { DocsApp } from '@brewsite/docs';
import { docsNav } from './docs-nav';

// Core pages — all mount eagerly (no React.lazy — see note_brewsite-docs-package.md §4)
import { GettingStartedPage } from './pages/core/GettingStarted';
import { InstallationPage } from './pages/core/Installation';
import { QuickStartPage } from './pages/core/QuickStart';
import { CoreConceptsPage } from './pages/core/CoreConcepts';
import { SceneDslPage } from './pages/core/SceneDsl';
import { MultiScenePage } from './pages/core/MultiScene';
import { TransitionsPage } from './pages/core/Transitions';
import { ModelPage } from './pages/core/ModelElement';
import { CameraPage } from './pages/core/CameraElement';
import { LightingPage } from './pages/core/LightingElement';
import { BackgroundPage } from './pages/core/BackgroundElement';
import { EnvironmentPage } from './pages/core/EnvironmentElement';
import { FloorPage } from './pages/core/FloorElement';
import { HudPage } from './pages/core/HudOverview';
import { HudAnimeJsPage } from './pages/core/HudAnimejs';
import { LabelSystemPage } from './pages/core/LabelSystem';
import { NavigationPage } from './pages/core/Navigation';
import { ActionsPage } from './pages/core/Actions';
import { ScenePlayerPage } from './pages/core/ScenePlayerRef';
import { HooksPage } from './pages/core/Hooks';
import { WidgetSdkPage } from './pages/core/Concepts';
import { CustomWidgetPage } from './pages/core/CustomWidget';
import { VariableStorePage } from './pages/core/VariableStore';
import { RegistryPage } from './pages/core/Registry';
import { ApiReferencePage } from './pages/core/ApiReference';
import { TimelinePage } from './pages/core/TimelineApi';

export default function App(): ReactElement {
  return (
    <DocsApp nav={docsNav}>
      <GettingStartedPage />
      <InstallationPage />
      <QuickStartPage />
      <CoreConceptsPage />
      <SceneDslPage />
      <MultiScenePage />
      <TransitionsPage />
      <ModelPage />
      <CameraPage />
      <LightingPage />
      <BackgroundPage />
      <EnvironmentPage />
      <FloorPage />
      <HudPage />
      <HudAnimeJsPage />
      <LabelSystemPage />
      <NavigationPage />
      <ActionsPage />
      <ScenePlayerPage />
      <HooksPage />
      <WidgetSdkPage />
      <CustomWidgetPage />
      <VariableStorePage />
      <RegistryPage />
      <ApiReferencePage />
      <TimelinePage />
    </DocsApp>
  );
}
```

### Step 5 — Rewrite `docs/src/pages/core/*.tsx`

Each page file gains a `<Section>` wrapper. The page function is renamed from `default export` to a named export. Content inside can remain largely unchanged, with these mechanical replacements:

1. Remove `import { Link } from 'react-router'` and all `<Link to="...">` navigation (replace with plain `<a>` or remove)
2. Replace `import { LiveDemo } from '../../components/demo/LiveDemo'` with `import { DocsDemo } from '@brewsite/docs'`
3. Replace `import { CodeBlock } from '../../components/ui/CodeBlock'` with `import { CodeBlock } from '@brewsite/docs'`
4. Replace `import { Callout } from '../../components/ui/Callout'` with `import { Callout } from '@brewsite/docs'`
5. Replace `<LiveDemo ...><DemoScene ...>` usage with `<DocsDemo ...><DemoName />` where `DemoName` is updated to use `DemoEngine`
6. Wrap the return value in `<Section<SectionId> id="section-id" title="Section Title">...</Section>`

**Example transformation — `docs/src/pages/core/GettingStarted.tsx`:**

Before:
```tsx
export default function GettingStarted(): JSX.Element {
  return (
    <section>
      <h1>What is BrewSite Core?</h1>
      <LiveDemo title="Three scenes" code={MULTI_SCENE_CODE}>
        <MultiSceneDemo />
      </LiveDemo>
      ...
    </section>
  );
}
```

After:
```tsx
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { MultiSceneDemo } from '../../demos/core/MultiSceneDemo.demo';

export function GettingStartedPage(): ReactElement {
  return (
    <Section<SectionId> id="getting-started" title="What is BrewSite Core?">
      <p>...</p>
      <DocsDemo title="Three scenes, one ScenePlayer" scrollUnits={2400} height={480}>
        <MultiSceneDemo />
      </DocsDemo>
      ...
    </Section>
  );
}
```

**Required section id mappings** (SectionId → page file → export name):

| SectionId | File | Export |
|---|---|---|
| `getting-started` | `pages/core/GettingStarted.tsx` | `GettingStartedPage` |
| `installation` | `pages/core/Installation.tsx` | `InstallationPage` |
| `quick-start` | `pages/core/QuickStart.tsx` | `QuickStartPage` |
| `concepts` | `pages/core/CoreConcepts.tsx` | `CoreConceptsPage` |
| `scene-dsl` | `pages/core/SceneDsl.tsx` | `SceneDslPage` |
| `multi-scene` | `pages/core/MultiScene.tsx` | `MultiScenePage` |
| `transitions` | `pages/core/Transitions.tsx` | `TransitionsPage` |
| `model` | `pages/core/ModelElement.tsx` | `ModelPage` |
| `camera` | `pages/core/CameraElement.tsx` | `CameraPage` |
| `lighting` | `pages/core/LightingElement.tsx` | `LightingPage` |
| `background` | `pages/core/BackgroundElement.tsx` | `BackgroundPage` |
| `environment` | `pages/core/EnvironmentElement.tsx` | `EnvironmentPage` |
| `floor` | `pages/core/FloorElement.tsx` | `FloorPage` |
| `hud` | `pages/core/HudOverview.tsx` | `HudPage` |
| `hud-animejs` | `pages/core/HudAnimejs.tsx` | `HudAnimeJsPage` |
| `labels` | `pages/core/LabelSystem.tsx` | `LabelSystemPage` |
| `input-navigation` | `pages/core/Navigation.tsx` | `NavigationPage` |
| `input-actions` | `pages/core/Actions.tsx` | `ActionsPage` |
| `player` | `pages/core/ScenePlayerRef.tsx` | `ScenePlayerPage` |
| `hooks` | `pages/core/Hooks.tsx` | `HooksPage` |
| `widget-sdk` | `pages/core/Concepts.tsx` | `WidgetSdkPage` |
| `custom-widget` | `pages/core/CustomWidget.tsx` | `CustomWidgetPage` |
| `variable-store` | `pages/core/VariableStore.tsx` | `VariableStorePage` |
| `widget-registry` | `pages/core/Registry.tsx` | `RegistryPage` |
| `api-reference` | `pages/core/ApiReference.tsx` | `ApiReferencePage` |
| `timeline` | `pages/core/TimelineApi.tsx` | `TimelinePage` |

### Step 6 — Update `docs/src/demos/core/*.demo.tsx`

Each demo file currently exports a component that wraps `<DemoScene>`. After migration, each demo is a component that wraps `<DemoEngine>` directly.

**Example transformation — `MultiSceneDemo.demo.tsx`:**

Before:
```tsx
export default function MultiSceneDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={3} sceneDuration={2500}>
      <Scene key="s1" id="s1">...</Scene>
      ...
    </DemoScene>
  );
}
```

After:
```tsx
import { DemoEngine } from '@brewsite/docs';
import { corePlugin, SceneCanvas } from '@brewsite/core';

// Stable plugins list — module-level to prevent EngineProvider rebuilds.
const DEMO_PLUGINS = [corePlugin()];

export function MultiSceneDemo(): JSX.Element {
  return (
    <DemoEngine plugins={DEMO_PLUGINS} manifestUrl="/scene-manifest.json">
      <Scene key="s1" id="s1">...</Scene>
      <Scene key="s2" id="s2">...</Scene>
      <Scene key="s3" id="s3">...</Scene>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
    </DemoEngine>
  );
}
```

**Key rule — stable plugins:** The `plugins` array passed to `DemoEngine` MUST be a module-level constant or stable memoized value. Do NOT create it inline in the render function (`plugins={[corePlugin()]}`). A new array reference on every render causes `EngineProvider` to rebuild the entire Three.js driver, creating a permanent flicker.

**Key rule — do NOT include `<EngineInputRegion>` or `<EngineScrollRegion>` in demos.** The existing `DemoScene` wrapped children in `<EngineInputRegion fillContainer>`. Do NOT carry this forward. `DemoEngine` manages progress via wheel capture from the parent `DocsDemo`. Including `<EngineInputRegion>` or `<EngineScrollRegion>` inside a `DemoEngine` child would conflict with the wheel-capture model and must be removed when migrating old demos. Remove these wrappers from ALL migrated demo files.

### Step 7 — Update CSS files in `docs/src/style/`

The `docs/src/style/` CSS files are kept and updated:

**`docs/src/style/layout.css`** — remove all React Router `.doc-layout`, `.doc-sidebar`, `.nav-item` route-link styles. The new layout uses inline styles plus class names from `@brewsite/docs` components. The following class names remain active and need CSS rules:
- `.docs-sidebar` — sidebar container (base background, borders)
- `.nav-section` — nav group wrapper
- `.nav-section__title` — group title text
- `.nav-item` — section button
- `.nav-item--active` — active section modifier
- `.docs-scroll-region` — scroll content region
- `.docs-content` — content max-width container

The following class names are new from `@brewsite/docs` components:
- `.docs-demo__title` — demo title label
- `.code-block` — code block root
- `.code-block__toolbar` — toolbar row
- `.code-block__lang` — language label
- `.copy-btn` — copy button
- `.callout` — callout root
- `.callout--note / --warning / --tip` — callout type modifiers
- `.callout__label` — callout type label
- `.callout__body` — callout content
- `.prop-table` — prop table root
- `.prop-table__required` — required prop marker

**`docs/src/style/variables.css`** — keep as-is. All CSS custom properties remain valid (they are referenced by inline styles in `@brewsite/docs` via `var(--token, fallback)` pattern).

### Step 8 — Update `pnpm-workspace.yaml`

The root-level `docs/` directory remains a workspace member. No change to `pnpm-workspace.yaml` is needed because `packages/*` already covers `packages/docs`.

---

## Work Stream Parallelization

The implementation is split into 5 independent streams. Dependencies are explicit.

```
Stream A ──► Stream B ──► Stream D (migration)
Stream C ────────────────► Stream D (migration)
Stream E (independent)
```

### Stream A — Package scaffold + nav + section (no dependencies)

**Owner:** Developer A
**Files owned:**
- `packages/docs/package.json`
- `packages/docs/tsconfig.json`
- `packages/docs/tsconfig.build.json`
- `packages/docs/vitest.config.ts`
- `packages/docs/src/index.ts` (stub — export stubs, fill as other streams land)
- `packages/docs/src/nav/types.ts`
- `packages/docs/src/nav/defineDocsNav.ts`
- `packages/docs/src/nav/__tests__/defineDocsNav.test.ts`
- `packages/docs/src/section/Section.tsx`
- `packages/docs/src/section/__tests__/Section.test.tsx`

**No blockers.** Start immediately.
**Output:** A typechecking, testing `@brewsite/docs` package scaffold with `defineDocsNav` and `Section` working.

---

### Stream B — Demo engine stack (depends on Stream A for package scaffold only)

**Owner:** Developer B
**Blocker:** Stream A must have `packages/docs/package.json` and `tsconfig.json` in place (so `tsc` resolves).
**Files owned:**
- `packages/docs/src/demo/normalizeDelta.ts`
- `packages/docs/src/demo/DemoCaptureContext.ts`
- `packages/docs/src/demo/WheelCaptureDemo.tsx`
- `packages/docs/src/demo/DocsDemo.tsx`
- `packages/docs/src/demo/DemoEngine.tsx`
- `packages/docs/src/demo/__tests__/normalizeDelta.test.ts`
- `packages/docs/src/demo/__tests__/WheelCaptureDemo.test.tsx`
- `packages/docs/src/demo/__tests__/DocsDemo.test.tsx`

**Must NOT touch:** Stream A files, Stream C files.
**Output:** `DocsDemo` + `DemoEngine` working with full test coverage.

---

### Stream C — Layout components + hooks + UI primitives (depends on Stream A for package scaffold only)

**Owner:** Developer C
**Blocker:** Stream A must have `packages/docs/package.json` and `tsconfig.json`.
**Files owned:**
- `packages/docs/src/layout/DocsApp.tsx`
- `packages/docs/src/layout/DocsSidebar.tsx`
- `packages/docs/src/layout/DocsScrollRegion.tsx`
- `packages/docs/src/layout/__tests__/DocsApp.test.tsx`
- `packages/docs/src/hooks/useActiveSectionId.ts`
- `packages/docs/src/hooks/useDemoProgress.ts`
- `packages/docs/src/ui/CodeBlock.tsx`
- `packages/docs/src/ui/CopyButton.tsx`
- `packages/docs/src/ui/Callout.tsx`
- `packages/docs/src/ui/PropTable.tsx`

**Must NOT touch:** Stream A files, Stream B files.
**Output:** `DocsApp`, `DocsSidebar`, `DocsScrollRegion`, all UI components, and hooks.

---

### Stream D — `docs/` app migration (depends on Streams A, B, C all complete)

**Owner:** Developer D
**Blocker:** Streams A, B, C must all be complete and typechecking (`pnpm --filter @brewsite/docs typecheck`).
**Files owned (all in `docs/src/`):**
- `docs/package.json` — rename, add `@brewsite/docs` dep, remove `react-router`
- `docs/src/docs-nav.ts` — new file
- `docs/src/App.tsx` — full rewrite
- `docs/src/pages/core/*.tsx` — all 26 page files (add Section wrapper, update imports)
- `docs/src/demos/core/*.demo.tsx` — all demo files (replace DemoScene with DemoEngine)
- Delete dead code listed in Step 2

**Must NOT touch:** `packages/docs/` files (Stream A/B/C territory).
**Output:** `docs/` app boots, renders, typecheck passes.

---

### Stream E — `packages/docs/src/index.ts` final (depends on Streams B, C to finalize exports)

**Owner:** Developer E (or Stream A developer)
**Blocker:** Streams B and C must have finalized their public export shapes.
**Files owned:**
- `packages/docs/src/index.ts` — finalize all exports (all symbols from streams B and C)
- Update `packages/docs/package.json` `files` array if needed

**Note:** Stream A creates a stub `index.ts` early. Stream E finalizes it once B and C are merged. Stream D (migration) **must not start until Stream E is complete** — see dependency note below.

---

### Dependency graph summary

```
A (scaffold) ──► B (demo stack, independent of C)
A (scaffold) ──► C (layout+UI, independent of B)
B + C both complete ──► E (index.ts finalization)
E complete ──────────► D (docs/ app migration)
```

Streams B and C can run fully in parallel once A is complete.
Stream E (index.ts finalization) must complete before Stream D starts.

**Why D cannot start before E:** `docs/` app imports from `@brewsite/docs`, which resolves to `packages/docs/src/index.ts` at dev time. If Stream A's stub index is missing exports from B and C, all `import { DocsApp, DocsDemo, DemoEngine, ... } from '@brewsite/docs'` statements in page files and App.tsx will fail typecheck. Stream D is blocked until the complete, final `index.ts` from Stream E is in place.

---

## CSS / Styling Direction

### Philosophy

`@brewsite/docs` has **zero CSS output files**. All visual styling is the consumer's responsibility. Components:

1. Use **inline styles for structural layout** (display, position, overflow, flex/grid, height, width). These cannot be overridden by accident and are always correct.
2. Use **CSS Custom Properties** (`var(--sidebar-width, 260px)`) for all theming tokens, with fallback values. Consumers override these at `:root`.
3. Apply **BEM class names** (`.docs-sidebar`, `.nav-item`, `.nav-item--active`, `.callout--note`, etc.) for consumer styling surface. These classes have no default styles from the library.

### Hover states — consumer responsibility

Inline styles cannot express pseudo-class rules (`:hover`, `:focus-visible`). The following states **must** be provided by the consumer in their stylesheet — the library provides no defaults for them:

- `.nav-item:hover` — hover background on sidebar nav buttons
- `.nav-item:focus-visible` — keyboard focus indicator on sidebar nav buttons
- `.copy-btn:hover` — hover feedback on code copy button

The `docs/src/style/layout.css` file must define these rules. Example:

```css
.nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.nav-item:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: -2px;
}
.copy-btn:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}
```

If these rules are absent, the sidebar buttons have no hover feedback and the copy button has no hover state. This is a consumer gap, not a library gap, but it is **required for a functional UI**.

### Required CSS Variables in consumer

The `docs/` app must define these at `:root` in `variables.css` (already exists):

```css
/* Already defined — verify these are present */
--bg-page, --bg-sidebar, --bg-surface, --bg-elevated,
--bg-code, --bg-demo,
--border-subtle, --border-default,
--text-primary, --text-secondary, --text-muted, --text-code,
--accent-blue, --accent-orange,
--sidebar-width (260px),
--content-max-width (820px),
--font-sans, --font-mono,
--shadow-demo
```

### Class names exposed for consumer CSS

These classes are applied by library components but have no default styles:

| Class | Component | Usage |
|---|---|---|
| `.docs-sidebar` | `DocsSidebar` | Root aside element |
| `.nav-section` | `DocsSidebar` | Group wrapper |
| `.nav-section__title` | `DocsSidebar` | Group title |
| `.nav-item` | `DocsSidebar` | Section button base |
| `.nav-item--button` | `DocsSidebar` | Button variant |
| `.nav-item--active` | `DocsSidebar` | Active section modifier |
| `.docs-scroll-region` | `DocsScrollRegion` | Scroll container |
| `.docs-content` | `DocsScrollRegion` | Max-width content wrapper |
| `.docs-demo__title` | `DocsDemo` | Demo title label |
| `.code-block` | `CodeBlock` | Root wrapper |
| `.code-block__toolbar` | `CodeBlock` | Toolbar row |
| `.code-block__lang` | `CodeBlock` | Language label |
| `.copy-btn` | `CopyButton` | Copy button |
| `.callout` | `Callout` | Root aside |
| `.callout--note/--warning/--tip` | `Callout` | Type modifiers |
| `.callout__label` | `Callout` | Type label |
| `.callout__body` | `Callout` | Content |
| `.prop-table` | `PropTable` | Table root |
| `.prop-table__required` | `PropTable` | Required marker |

---

## Error Handling

### `DemoEngine` / `EngineProvider` errors

`EngineProvider` accepts `onError?: (error: Error) => void` and `onManifestError?: (error: Error) => void`. `DemoEngine` forwards these via `...rest`. Demo authors must pass error callbacks:

```tsx
<DemoEngine
  plugins={DEMO_PLUGINS}
  manifestUrl="/scene-manifest.json"
  onError={(err) => console.error('[Demo]', err)}
  onManifestError={(err) => console.warn('[Demo manifest]', err)}
>
```

`@brewsite/docs` itself does not install global error boundaries. Demo authors are responsible for `onError` handling.

### `DemoCaptureContext` not found

`DemoEngine` uses `useContext(DemoCaptureContext)` which returns `null` if used outside `<DocsDemo>`. The `DemoEngineRegistrar` guards this:

```typescript
const captureCtx = useContext(DemoCaptureContext);
useEffect(() => {
  if (!captureCtx) return; // Silently no-op — DemoEngine used outside DocsDemo
  ...
}, [captureCtx, setRawProgress]);
```

When used outside `<DocsDemo>`, `DemoEngine` behaves as a plain `EngineProvider`. No error is thrown. This is intentional — demo authors may test demos in isolation without a `DocsDemo` wrapper.

### IntersectionObserver not available

SSR is out of scope. `IntersectionObserver` is used directly without guards. If a consumer attempts to run in a non-browser environment, they will receive a `ReferenceError: IntersectionObserver is not defined`. Document this as a browser-only constraint in the library README.

### `setRawProgressRef.current` is null

When `WheelCaptureDemo.onWheelDelta` fires before `DemoEngine` has mounted (race condition), `setRawProgressRef.current` is null. The call is silently dropped:

```typescript
setRawProgressRef.current?.(next);  // optional chaining — no-op if null
```

This is safe because the demo engine hasn't rendered yet; there is nothing to advance.

---

## State Management

| State | Location | Mechanism |
|---|---|---|
| Active section id | `DocsApp` useState | IntersectionObserver callback → setActiveId |
| Demo mount state | `DocsDemo` useState | IntersectionObserver callback → setIsMounted |
| Demo hover state | `DocsDemo` useState | mouseenter / mouseleave → setIsHovered |
| Demo progress | `DocsDemo` progressRef (mutable) | Imperative ref — no re-render on delta |
| DemoEngine setRawProgress | `DocsDemo` setRawProgressRef | Registered via DemoCaptureContext.registerEngine |
| URL hash | none (side effect) | history.replaceState in DocsApp useEffect |
| Hash navigation target | none (side effect) | document.getElementById().scrollIntoView in DocsApp useEffect |

**Why `progressRef` instead of `useState` for demo progress:**
Wheel events fire at up to 60fps during fast scrolling. Using `useState` would trigger 60 React re-renders per second for the entire `DocsDemo` subtree, including re-rendering the mounted `DemoEngine`. `progressRef` + imperative `setRawProgress` call bypasses React's render pipeline entirely. Progress advancement is O(1) per wheel event with zero React overhead.

---

## Turborepo / Build Pipeline

Add `packages/docs` to the Turborepo build graph. Update `turbo.json` if it specifies explicit package inputs. The `build:lib` script must run after `@brewsite/core` build:

**`packages/docs/package.json` scripts:**
```json
{
  "scripts": {
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

The `docs/` app's Vite dev server resolves `@brewsite/docs` via workspace symlink to `packages/docs/src/index.ts` (not the built `dist/`), so `packages/docs` does NOT need to be built for local development. The `tsconfig.json` in `packages/docs` uses `"paths": { "@brewsite/core": ["../core/src/index.ts"] }` for dev-time resolution.

**`pnpm-workspace.yaml`** — no changes needed. `'packages/*'` already covers `packages/docs`.

---

## Completion Criteria

A developer reading this plan and implementing it should be able to verify completion with:

```bash
# 1. Package typechecks
pnpm --filter @brewsite/docs typecheck

# 2. Package tests pass
pnpm --filter @brewsite/docs test

# 3. Docs app typechecks
pnpm --filter @brewsite/docs-app typecheck

# 4. Docs app dev server starts without errors
pnpm --filter @brewsite/docs-app dev

# 5. All section ids in docs-nav.ts are matched by a <Section> element in the page
# (verified by scrolling through the rendered page)

# 6. Wheel scroll over a DocsDemo region advances the demo canvas
# (verified by manual interaction in browser)

# 7. Dead code files listed in Step 2 do not exist
```
