// NodeHandler implementations for <View> and <ViewLayout>.
// Handlers are pure — no Three.js, no side effects beyond api.state writes.

import React, { type ReactElement } from 'react';
import { isValidElement } from 'react';
import type { CompileApi, NodeHandler } from '../sceneDslTypes';
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
import { compileCarouselScrubber } from '../../elements/carousel-scrubber/compile';
import { resolveSceneTheme } from '../../theme/sceneThemeRegistry';
import { normalizePadding, applyPaddingToRect } from '../../layout/regionNormalize';

// DEBT: Replace this invisible side-channel with an explicit parameter on CompileApi
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
    if (childEl.type === CarouselTray) continue; // handled separately below
    if (childEl.type !== View) {
      console.warn(
        `[ViewLayout] ViewLayout '${layoutId}' (scene '${api.state.id}') contains non-View child <${(childEl.type as { displayName?: string })?.displayName ?? 'unknown'}>; only <View> and <CarouselTray> children are supported.`,
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

  // ── CarouselTray detection ──────────────────────────────────────────────
  // If a <CarouselTray> child is present inside a carousel ViewLayout,
  // automatically emit a CarouselScrubberState derived from the layout bounds.
  // The tray sizes and positions itself automatically from the carousel config.
  //
  // THEME RESOLUTION AT COMPILE TIME (not render time):
  // The theme is resolved HERE via resolveSceneTheme() and baked into the
  // compiled state. This is the same pattern used by diagrams and charts.
  //
  // WHY NOT RENDER TIME? The scene.userData.__brewsite_scene_theme approach
  // (used by FloorWidget) suffers from an Object.is reference equality problem:
  // resolveSceneTheme() returns the same constant object reference for a given
  // family+polarity pair. When a polarity toggle returns to a previously-seen
  // value, React effects with [sceneTheme] deps silently skip because the
  // reference hasn't changed. Compile-time resolution avoids this entirely —
  // when the theme changes, scenes re-render, the compiler re-runs, and the
  // widget receives fresh theme-resolved state via apply().
  if (kind === 'carousel') {
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as ReactElement;
      if (childEl.type !== CarouselTray) continue;

      const trayProps = childEl.props as CarouselTrayProps;
      const carouselConfig = layoutConfig as CarouselLayoutConfig;
      const isLoop = carouselConfig.loop ?? false;
      const trayDepth = trayProps.depth ?? 0.36;

      // Compute the actual NVS extent of all resolved views (tight bounding box).
      // This is the real footprint of the carousel content, NOT the container.
      let extMinX = Infinity;
      let extMinY = Infinity;
      let extMaxX = -Infinity;
      let extMaxY = -Infinity;
      for (const vid of viewIds) {
        const vs = api.state.widgets[vid] as { bounds?: { x: number; y: number; w: number; h: number } } | undefined;
        if (!vs?.bounds) continue;
        extMinX = Math.min(extMinX, vs.bounds.x);
        extMinY = Math.min(extMinY, vs.bounds.y);
        extMaxX = Math.max(extMaxX, vs.bounds.x + vs.bounds.w);
        extMaxY = Math.max(extMaxY, vs.bounds.y + vs.bounds.h);
      }
      const viewExtent = Number.isFinite(extMinX)
        ? { x: extMinX, y: extMinY, w: extMaxX - extMinX, h: extMaxY - extMinY }
        : composedContainerBounds;

      // Resolve theme at compile time — same pattern as diagrams and charts.
      // The compiled state bakes in the theme-resolved style values so the tray
      // updates immediately when the scene track recompiles on theme change.
      // DSL props override theme values; theme values override compiled defaults.
      const sceneTheme = resolveSceneTheme(api.context.themeFamily, api.context.themePolarity);
      const trayTheme = sceneTheme.carouselTray;

      const trayWidgetId = `${layoutId}__tray`;
      const trayState = compileCarouselScrubber(
        {
          id: trayWidgetId,
          layoutId,
          showBase: true,
          trayDepth,
          gap: trayProps.gap ?? trayTheme?.gap,
          style: {
            baseColor: trayProps.color ?? trayTheme?.color,
            baseOpacity: trayProps.opacity ?? trayTheme?.opacity,
            accentColor: trayProps.accentColor ?? trayTheme?.accentColor,
            metalness: trayProps.metalness ?? trayTheme?.metalness,
            roughness: trayProps.roughness ?? trayTheme?.roughness,
            edgeStyle: trayProps.edgeStyle ?? trayTheme?.edgeStyle,
            surfacePattern: trayProps.surfacePattern ?? trayTheme?.surfacePattern,
            surfaceIntensity: trayProps.surfaceIntensity ?? trayTheme?.surfaceIntensity,
            surfaceMapUrl: trayProps.surfaceMapUrl ?? trayTheme?.surfaceMapUrl,
          },
        },
        carouselConfig.activeIndex,
        viewIds.length,
        isLoop,
        composedContainerBounds,
        { zStep: carouselConfig.zStep, spread: carouselConfig.spread },
        viewExtent,
      );
      api.setWidgetState(trayWidgetId, trayState);
      break; // only one CarouselTray per ViewLayout
    }
  }
};
