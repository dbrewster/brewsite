// NodeHandler implementations for <View> and <ViewLayout>.
// Handlers are pure — no Three.js, no side effects beyond api.state writes.

import React, { type ReactElement } from 'react';
import { isValidElement } from 'react';
import type { NodeHandler } from '../sceneDslTypes';
import { createChildApi } from '../childApi';
import { IMPLICIT_SCENE_ROOT_VIEW_ID } from '../sceneViewConstraint';
import type { NVSRect } from '../../layout/types';
import type { ViewLayoutConfig, ViewLayoutResult, CarouselLayoutConfig } from '../../layout/regionTypes';
import type { ViewState, ViewLayoutState } from '../viewTypes';
import type { ViewProps } from './viewDsl';
import { View } from './viewDsl';
import type { ViewLayoutProps } from './viewLayoutDsl';
import { resolveLayout } from '../../layout/regionLayout';
import { CarouselTray } from '../../elements/carousel-scrubber/dsl';
import type { CarouselTrayProps } from '../../elements/carousel-scrubber/dsl';
import { Highlight } from '../../elements/carousel-scrubber/highlightDsl';
import type { HighlightProps } from '../../elements/carousel-scrubber/highlightDsl';
import { compileTrayFromViewLayout, type TrayViewBounds } from '../../elements/carousel-scrubber/compileTray';
import { normalizePadding, applyPaddingToRect } from '../../layout/regionNormalize';

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

  // Guard against authors using the reserved '__...__' naming pattern.
  // Allow the compiler's own sentinel (IMPLICIT_SCENE_ROOT_VIEW_ID = '__scene_root__')
  // but warn on any other double-underscore-wrapped id.
  if (
    id !== IMPLICIT_SCENE_ROOT_VIEW_ID &&
    id.startsWith('__') &&
    id.endsWith('__')
  ) {
    console.warn(
      `[View] ID "${id}" uses the reserved '__...__' naming pattern. ` +
      `This prefix is reserved for compiler-generated views. Choose a different id.`,
    );
  }

  let bounds: NVSRect;
  let layer: number;
  let scale: number;
  let zOffset: number;
  let viewOpacity: number;
  let layoutId: string | undefined;

  const layoutContext = api.layoutContext;

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
  //
  // Carousel (layoutId present): compile children with opacity=1 so ViewWidget
  // controls fade at runtime. Non-carousel views keep the baked-in opacity.
  const childOpacityScale = layoutId !== undefined ? 1 : viewOpacity;
  const childApi = createChildApi(api, contentBounds, zOffset, childOpacityScale);

  // Compile children using the scoped child api.
  // Use compileChildrenSeparated so non-DSL children (e.g. <TextBox>, HTML elements)
  // are collected as overlay content rather than silently dropped.
  const overlayNodes = helpers.compileChildrenSeparated(node, childApi);

  // If overlay content was found, wrap it in a positioned container that matches
  // this View's NVS bounds, then push it up to the scene root's overlay collection.
  // This makes <TextBox x={0} y={0} w={1} h={1}> inside a View fill the View's
  // spatial region on screen, not the entire viewport.
  if (overlayNodes.length > 0) {
    const viewOverlay = React.createElement(
      'div',
      {
        key: `view-overlay-${id}`,
        style: {
          position: 'absolute' as const,
          left: `${bounds.x * 100}%`,
          top: `${bounds.y * 100}%`,
          width: `${bounds.w * 100}%`,
          height: `${bounds.h * 100}%`,
          zIndex: layer,
          opacity: viewOpacity,
          pointerEvents: 'none' as const,
          boxSizing: 'border-box' as const,
        },
      },
      ...overlayNodes,
    );
    api.pushOverlay(viewOverlay);
  }

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
    childWidgetIds: childApi.childWidgetIds,
  };
  api.setWidgetState(id, viewState);
};

/**
 * NodeHandler for the <ViewLayout> DSL component.
 * Resolves layout for all child Views, propagates bounds via CompileApi.layoutContext,
 * and stores ViewLayoutState in api.state.
 */
export const viewLayoutHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as ViewLayoutProps;
  const { id: explicitId, kind, x, y, w, h, gap, direction, activeIndex: deprecatedActiveIndex, focusedIndex: explicitFocusedIndex, inactiveScale, zStep, loop, spread, fadeMin } = props;

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
    if (childEl.type === CarouselTray) continue; // handled separately below
    if (childEl.type === Highlight) continue; // handled separately below
    if (childEl.type !== View) {
      console.warn(
        `[ViewLayout] ViewLayout '${layoutId}' (scene '${api.state.id}') contains non-View child <${(childEl.type as { displayName?: string })?.displayName ?? 'unknown'}>; only <View>, <CarouselTray>, and <Highlight> children are supported.`,
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

  // Resolve focusedIndex with deprecation shim
  let resolvedFocusedIndex: number;
  if (explicitFocusedIndex !== undefined) {
    resolvedFocusedIndex = explicitFocusedIndex;
  } else if (deprecatedActiveIndex !== undefined) {
    console.warn(
      `[ViewLayout] "${layoutId}": \`activeIndex\` is deprecated. Use \`focusedIndex\` instead. ` +
      `\`activeIndex\` will be removed in the next major version.`,
    );
    resolvedFocusedIndex = deprecatedActiveIndex;
  } else {
    resolvedFocusedIndex = 0;
  }

  // Build layout config from props
  let layoutConfig: ViewLayoutConfig;
  if (kind === 'stack') {
    layoutConfig = { kind: 'stack', direction: direction ?? 'horizontal', gap };
  } else {
    layoutConfig = { kind: 'carousel', activeIndex: resolvedFocusedIndex, gap, inactiveScale, zStep, loop, spread, fadeMin };
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

  // Create a scoped API with layout context — child View handlers read api.layoutContext.
  // withLayoutContext returns a new API without mutating the original, so nested
  // ViewLayouts naturally restore the outer context when their scope ends.
  const scopedApi = api.withLayoutContext({ layoutId, viewResults });

  // Compile child <View> nodes — each view handler reads its bounds from scopedApi.layoutContext
  helpers.compileChildren(node, scopedApi);

  // Store ViewLayoutState
  const viewLayoutState: ViewLayoutState = {
    id: layoutId,
    kind,
    bounds: composedContainerBounds,
    viewIds,
    ...(kind === 'carousel' ? { layoutConfig, childSizeHints } : {}),
  };
  api.setWidgetState(layoutId, viewLayoutState);

  // ── CarouselTray + Highlight detection ──────────────────────────────────
  // If a <CarouselTray> child is present inside a carousel ViewLayout,
  // compile it via compileTrayFromViewLayout — the extracted pure function
  // that owns theme resolution, view extent computation, and style merging.
  //
  // <Highlight> children are collected and passed to compileTrayFromViewLayout
  // as DSL highlight configs. They require a <CarouselTray> sibling to render.
  //
  // Theme is resolved at compile time (not render time) to avoid the
  // Object.is reference equality bug described in compileTray.ts.
  if (kind === 'carousel') {
    // Collect <Highlight> children.
    const highlightConfigs: HighlightProps[] = [];
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as ReactElement;
      if (childEl.type === Highlight) {
        highlightConfigs.push(childEl.props as HighlightProps);
      }
    }

    let hasTray = false;
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as ReactElement;
      if (childEl.type !== CarouselTray) continue;

      hasTray = true;
      const trayProps = childEl.props as CarouselTrayProps;
      const carouselConfig = layoutConfig as CarouselLayoutConfig;

      // Build view bounds map from compiled widget state for the extracted function.
      const viewBoundsMap = new Map<string, TrayViewBounds>();
      for (const vid of viewIds) {
        const vs = api.state.widgets[vid] as { bounds?: { x: number; y: number; w: number; h: number } } | undefined;
        if (vs?.bounds) {
          viewBoundsMap.set(vid, { bounds: vs.bounds });
        }
      }

      const trayState = compileTrayFromViewLayout(
        trayProps,
        layoutId,
        carouselConfig,
        viewIds,
        composedContainerBounds,
        viewBoundsMap,
        api.context.themeFamily,
        api.context.themePolarity,
        highlightConfigs.length > 0 ? highlightConfigs : undefined,
      );
      api.setWidgetState(`${layoutId}__tray`, trayState);
      break; // only one CarouselTray per ViewLayout
    }

    // Warn if <Highlight> children exist but no <CarouselTray> sibling.
    if (highlightConfigs.length > 0 && !hasTray) {
      console.warn(
        '[ViewLayout] <Highlight> requires a <CarouselTray> sibling to render. Highlights will be ignored.',
      );
    }
  }
};
