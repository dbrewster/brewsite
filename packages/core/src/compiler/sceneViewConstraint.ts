// sceneViewConstraint.ts — Enforces the Scene view constraint:
// at most one spatial direct child without Views; all spatial children
// must be inside Views when Views are present.
//
// Called by the sceneRootHandler before compilation of Scene children.

import React, { isValidElement, type ReactElement } from 'react';
import type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
import { getHandlerCategory, isPrimitiveComponent } from './registry';
import type { ViewProps } from './blocks/viewDsl';

/**
 * The reserved id used for the auto-generated implicit root View.
 *
 * When a Scene has exactly one spatial element and no explicit `<View>` wrappers,
 * the compiler auto-wraps that element in a full-screen View with this ID:
 * `<View id="__scene_root__" x={0} y={0} w={1} h={1}>`. This is transparent
 * to the element — it receives composed bounds as if the View were authored
 * explicitly. The auto-wrap happens in `enforceSceneChildConstraint` Case 3.
 *
 * The `__...__` naming pattern is reserved for compiler-generated views.
 * Scene authors who use this pattern on their own View IDs will get a warning.
 */
export const IMPLICIT_SCENE_ROOT_VIEW_ID = '__scene_root__';

/**
 * Result of constraint enforcement. The caller compiles `remaining` children
 * (spatial children that were auto-wrapped or errored are already excluded).
 */
export type ConstraintResult = {
  /** Children that should be compiled by the caller (spatial children removed). */
  remaining: unknown[];
};

/**
 * Scans direct Scene children (shallow — Fragments expanded, function components
 * NOT expanded) and enforces the view constraint. Spatial children that are
 * auto-wrapped or errored are compiled/skipped here; the returned `remaining`
 * array contains only the children the caller should pass to compilation.
 *
 * Uses the same `collectChildrenShallow` output that `compileChildrenSeparated`
 * uses, ensuring reference equality between classified and compiled children.
 *
 * Four cases:
 * - Case 1: Spatial + View children mixed — error, skip spatial children.
 * - Case 2: Multiple spatial children, no Views — error, skip all spatial.
 * - Case 3: Single spatial child, no Views — auto-wrap in implicit full-screen
 *   View (id = `__scene_root__`, bounds 0,0,1,1). The element receives composed
 *   bounds via the View's child CompileApi as if the author wrote the View explicitly.
 * - Case 4: No spatial children — nothing to do, all children compile normally.
 *
 * Design decisions:
 * - HTML string elements (<div>, <h1>, etc.) are skipped — they are overlay content
 *   and must not be misclassified as spatial.
 * - View/ViewLayout are matched by type reference, NOT by getHandlerCategory, so
 *   they trigger hasExplicitViews = true regardless of their ambient registration.
 * - Children with Fragments are already expanded by collectChildrenShallow before
 *   this function is called.
 */
export function enforceSceneChildConstraint(
  allChildren: unknown[],
  sceneId: string | null,
  api: CompileApi,
  helpers: CompileHelpers,
  deps: {
    viewHandler: NodeHandler;
    View: React.ComponentType<ViewProps>;
    ViewLayout: React.ComponentType<unknown>;
  },
): ConstraintResult {
  const directChildren = allChildren.filter(isValidElement) as ReactElement[];

  const viewChildren: ReactElement[] = [];
  const spatialChildren: ReactElement[] = [];
  // Ambient and HTML overlay children are not collected — they compile normally.

  for (const child of directChildren) {
    const type = child.type;
    // HTML elements (<div>, <h1>, etc.) are overlay content — not spatial, not ambient.
    if (typeof type === 'string') continue;
    // View and ViewLayout are classified as "view elements" via direct type reference
    // comparison, NOT via getHandlerCategory. This is intentional — the ambient category
    // is bypassed here because we need to distinguish "is this a View/ViewLayout?" from
    // "is this ambient?". Both are registered as 'ambient' but have special semantics.
    if (type === deps.View || type === deps.ViewLayout) {
      viewChildren.push(child);
    } else {
      // Only classify registered DSL components. Unregistered function components
      // (e.g. TextBox, custom wrappers) are overlay content — not subject to the constraint.
      // getHandlerCategory returns 'spatial' for unregistered components by default,
      // so we must guard with isPrimitiveComponent first.
      if (isPrimitiveComponent(type)) {
        const category = getHandlerCategory(type);
        if (category === 'spatial') {
          spatialChildren.push(child);
        }
        // 'ambient' — falls through to normal compilation in the caller
      }
      // Unregistered: treated as overlay content — falls through to normal compilation
    }
  }

  const hasExplicitViews = viewChildren.length > 0;
  // Build a set of spatial child references for fast lookup during filtering.
  const spatialSet = new Set<unknown>(spatialChildren);

  // ─── Case 1: Mixed — spatial children alongside View/ViewLayout children ────
  if (hasExplicitViews && spatialChildren.length > 0) {
    const names = spatialChildren
      .map((c) => getComponentDisplayName(c.type))
      .join(', ');
    console.error(
      `[Scene '${sceneId ?? 'unknown'}'] Spatial elements (${names}) cannot be ` +
      `direct <Scene> children when <View> or <ViewLayout> children are present. ` +
      `Wrap each spatial element in a <View>.`,
    );
    // Remove spatial children from remaining — they are not compiled.
    return { remaining: allChildren.filter((c) => !spatialSet.has(c)) };
  }

  // ─── Case 2: Multiple spatial children without Views — hard error ────────────
  if (!hasExplicitViews && spatialChildren.length > 1) {
    const names = spatialChildren
      .map((c) => getComponentDisplayName(c.type))
      .join(', ');
    console.error(
      `[Scene '${sceneId ?? 'unknown'}'] Multiple spatial elements (${names}) require ` +
      `explicit <View> wrappers. Use a single spatial element (auto-wrapped to fullscreen) ` +
      `or wrap each in a <View> inside a <ViewLayout>.`,
    );
    // Remove all spatial children — skip all to avoid partial output.
    return { remaining: allChildren.filter((c) => !spatialSet.has(c)) };
  }

  // ─── Case 3: Single spatial child — auto-wrap in implicit full-screen View ──
  if (!hasExplicitViews && spatialChildren.length === 1) {
    const spatialChild = spatialChildren[0]!;
    const implicitView = React.createElement(
      deps.View,
      {
        id: IMPLICIT_SCENE_ROOT_VIEW_ID,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      } as ViewProps,
      spatialChild,
    );
    deps.viewHandler(implicitView, api, helpers);
    // Remove the spatial child — it has been compiled through the viewHandler.
    return { remaining: allChildren.filter((c) => c !== spatialChild) };
  }

  // ─── Case 4: No spatial children — nothing to do ────────────────────────────
  // (Zero spatial, any number of ambient + TextBox + Views — always valid.)
  return { remaining: allChildren };
}

function getComponentDisplayName(type: ReactElement['type']): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? 'unknown';
  }
  return 'unknown';
}
