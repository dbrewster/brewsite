// NodeHandler implementations for <View> and <ViewLayout>.
// Handlers are pure — no Three.js, no side effects beyond api.state writes.

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type { CompileApi, NodeHandler } from '../sceneDslTypes';
import { createChildApi } from '../sceneDslCompiler';
import type { NVSRect } from '../../layout/types';
import type { ViewLayoutConfig, ViewLayoutResult } from '../../layout/regionTypes';
import type { ViewState, ViewLayoutState } from '../viewTypes';
import type { ViewProps } from './viewDsl';
import { View } from './viewDsl';
import type { ViewLayoutProps } from './viewLayoutDsl';
import { resolveLayout } from '../../layout/regionLayout';
import { normalizePadding, applyPaddingToRect } from '../../layout/regionNormalize';

// Module-level WeakMap — not on CompileApi, avoids polluting the SDK type.
// Keyed by CompileApi instance, stores the active layout context for view-child compilation.
type ViewLayoutContext = {
  layoutId: string;
  viewResults: Map<string, ViewLayoutResult>;
};
const layoutContextMap = new WeakMap<CompileApi, ViewLayoutContext>();

/**
 * NodeHandler for the <View> DSL component.
 * Resolves absolute NVS bounds, applies padding, creates a scoped child CompileApi,
 * compiles children, and stores ViewState in api.state.
 */
export const viewHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as ViewProps;
  const { id, x, y, w, h, padding } = props;

  // Validate id
  if (!id || typeof id !== 'string') {
    console.error('[View] Missing required "id" prop on <View>. View will not be compiled.');
    return;
  }

  let bounds: NVSRect;
  let layer: number;
  let scale: number;
  let zOffset: number;
  let viewOpacity: number;
  let layoutId: string | undefined;

  const layoutContext = layoutContextMap.get(api);

  if (layoutContext) {
    const viewResult = layoutContext.viewResults.get(id);
    // Warn if x or y are explicitly set inside a layout
    if (x !== undefined || y !== undefined) {
      console.warn(
        `[View] View '${id}' is inside a ViewLayout; x/y will be ignored. The layout manager controls positioning.`,
      );
    }
    if (viewResult) {
      bounds = viewResult.bounds;
      layer = viewResult.layer;
      scale = viewResult.scale;
      zOffset = viewResult.z;
      viewOpacity = viewResult.opacity;
    } else {
      // View ID not found in layout context — treat as standalone
      const localBounds: NVSRect = { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 };
      bounds = api.composeBounds(localBounds);
      layer = 0;
      scale = 1.0;
      zOffset = 0;
      viewOpacity = 1;
    }
    layoutId = layoutContext.layoutId;
  } else {
    // Standalone view — compose into any parent region
    const localBounds: NVSRect = { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 };
    bounds = api.composeBounds(localBounds);
    layer = 0;
    scale = 1.0;
    zOffset = 0;
    viewOpacity = 1;
  }

  // Resolve padding and compute content bounds
  const normalizedPadding = normalizePadding(padding ?? 0);
  const contentBounds = applyPaddingToRect(bounds, normalizedPadding);

  // Create child api with composeBounds scoped to this view's content bounds,
  // composeZ accumulating this view's Z offset, and composeOpacity multiplying
  // through the view's layout-assigned opacity.
  const childApi = createChildApi(api, contentBounds, zOffset, viewOpacity);

  // Compile children using the scoped child api
  helpers.compileChildren(node, childApi);

  // Store ViewState on the parent api (not childApi) — it belongs to the current scene
  const viewState: ViewState = {
    id,
    bounds,
    padding: normalizedPadding,
    contentBounds,
    layer,
    scale,
    z: zOffset,
    opacity: viewOpacity,
    layoutId,
  };
  api.setWidgetState(id, viewState);
};

/**
 * NodeHandler for the <ViewLayout> DSL component.
 * Resolves layout for all child Views, propagates bounds via WeakMap context,
 * and stores ViewLayoutState in api.state.
 */
export const viewLayoutHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as ViewLayoutProps;
  const { id: explicitId, kind, x, y, w, h, gap, direction, activeIndex, inactiveScale, zStep, loop, spread, fadeMin } = props;

  // Generate layout id if not provided
  const layoutId = explicitId ?? `__viewLayout_${kind}_${api.context.sceneIndex}`;

  // Resolve container bounds and compose into any parent region
  const localContainerBounds: NVSRect = { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 };
  const composedContainerBounds = api.composeBounds(localContainerBounds);

  // Collect <View> children and their size hints
  const children = helpers.collectChildren(node);
  const viewIds: string[] = [];
  const childSizeHints: Array<{ w: number; h: number }> = [];

  for (const child of children) {
    if (!isValidElement(child)) continue;
    const childEl = child as ReactElement;
    if (childEl.type !== View) {
      console.warn(
        `[ViewLayout] ViewLayout '${layoutId}' contains non-View child; only <View> children are supported.`,
      );
      continue;
    }
    const childProps = childEl.props as { id?: string; w?: number; h?: number };
    if (!childProps.id) {
      console.error(`[ViewLayout] <View> inside ViewLayout requires an 'id' prop.`);
      continue;
    }
    viewIds.push(childProps.id);
    // Use 0 as sentinel for "no explicit size" — layout algo distributes remaining space equally
    childSizeHints.push({ w: childProps.w ?? 0, h: childProps.h ?? 0 });
  }

  // Build layout config from props
  let layoutConfig: ViewLayoutConfig;
  if (kind === 'stack') {
    layoutConfig = { kind: 'stack', direction: direction ?? 'horizontal', gap };
  } else {
    layoutConfig = { kind: 'carousel', activeIndex: activeIndex ?? 0, gap, inactiveScale, zStep, loop, spread, fadeMin };
  }

  // Resolve layout for all children
  const layoutResults = resolveLayout(layoutConfig, composedContainerBounds, childSizeHints);

  // Build viewResults map: view id → resolved layout result
  const viewResults = new Map<string, ViewLayoutResult>();
  for (let i = 0; i < viewIds.length; i++) {
    const result = layoutResults[i];
    if (result) {
      viewResults.set(viewIds[i]!, result);
    }
  }

  // Save/restore previous layout context for nested ViewLayout support
  const previousContext = layoutContextMap.get(api);
  layoutContextMap.set(api, { layoutId, viewResults });

  // Compile child <View> nodes — each view handler reads its bounds from layoutContextMap
  helpers.compileChildren(node, api);

  // Restore previous context (critical for nested ViewLayouts)
  if (previousContext) {
    layoutContextMap.set(api, previousContext);
  } else {
    layoutContextMap.delete(api);
  }

  // Store ViewLayoutState
  const viewLayoutState: ViewLayoutState = {
    id: layoutId,
    kind,
    bounds: composedContainerBounds,
    viewIds,
    ...(kind === 'carousel' ? { layoutConfig, childSizeHints } : {}),
  };
  api.setWidgetState(layoutId, viewLayoutState);
};
