// FloorWidget — ISceneElement + IRenderable (simple prop-only DSL, no children).
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {IDslComposite, IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext,} from '../../widget/types';
import type {FloorSurface, FloorSurfaceMirror, FloorSurfacePhysical, SceneFloor} from './types';
import {DEFAULT_FLOOR, DEFAULT_GRID_SURFACE, DEFAULT_MIRROR_SURFACE, DEFAULT_PHYSICAL_SURFACE, functionalFloorTransitionSpec,} from './compile';
import type {FloorMirrorProps, FloorPhysicalProps, FloorProps} from './dsl';
import {applyFloor, disposeFloor} from './render';
import type * as React from 'react';
import {isValidElement} from 'react';
import type {SceneTheme} from '../../theme/types';
import type {IHasCustomDslHandler} from '../../widget/index';
import {CUSTOM_NODE_HANDLER} from '../../widget/index';
import type {NodeHandler} from '../../compiler/index';
import type {WidgetRegistry} from '../../widget/WidgetRegistry';
import type {MaterialApplication} from '../../widget/materialTypes';

/**
 * Floor element.
 *
 * Visible output requires one surface child:
 * - `<FloorPhysical ... />`
 * - `<FloorMirror ... />`
 */
export const Floor = (_props: FloorProps) => null;

Floor.displayName = 'Floor';

export const FloorPhysical = (_props: FloorPhysicalProps) => null;
FloorPhysical.displayName = 'FloorPhysical';

export const FloorMirror = (_props: FloorMirrorProps) => null;
FloorMirror.displayName = 'FloorMirror';

const SCENE_THEME_USERDATA_KEY = '__brewsite_scene_theme';

/**
 * Gathers MaterialApplication shorthand props from resolved FloorProps.
 * Returns undefined if no shorthand props are set.
 */
const gatherMaterialApplicationFromResolved = (
  resolved: Record<string, unknown>,
): MaterialApplication | undefined => {
  const colorMix = resolved['colorMix'] as number | undefined;
  const brightness = resolved['brightness'] as number | undefined;
  const saturation = resolved['saturation'] as number | undefined;
  const contrast = resolved['contrast'] as number | undefined;
  const depthMix = resolved['depthMix'] as number | undefined;
  const roughnessMix = resolved['roughnessMix'] as number | undefined;
  const tint = resolved['tint'] as string | undefined;
  const texScale = resolved['texScale'] as number | undefined;
  const iridescence = resolved['iridescence'] as number | undefined;
  const iridescenceIOR = resolved['iridescenceIOR'] as number | undefined;
  const iridescenceThicknessRange = resolved['iridescenceThicknessRange'] as readonly [number, number] | undefined;

  const hasAny =
    colorMix !== undefined || brightness !== undefined || saturation !== undefined ||
    contrast !== undefined || depthMix !== undefined || roughnessMix !== undefined ||
    tint !== undefined || texScale !== undefined || iridescence !== undefined ||
    iridescenceIOR !== undefined || iridescenceThicknessRange !== undefined;

  if (!hasAny) return undefined;

  return {
    colorMix, brightness, saturation, contrast, depthMix, roughnessMix,
    tint, texScale, iridescence, iridescenceIOR, iridescenceThicknessRange,
  };
};

const resolveThemedFloorState = (
  state: SceneFloor,
  theme: SceneTheme | null | undefined,
): SceneFloor => {
  const floorTheme = theme?.floor;
  if (!floorTheme) return state;

  let changed = false;
  let result: SceneFloor = state;

  const ensureSceneClone = (): void => {
    if (changed) return;
    result = {...result};
    changed = true;
  };

  if (
    floorTheme.negativeZExtent !== undefined &&
    (result.negativeZExtent === undefined || result.negativeZExtent === DEFAULT_FLOOR.negativeZExtent)
  ) {
    ensureSceneClone();
    result.negativeZExtent = floorTheme.negativeZExtent;
  }
  if (
    floorTheme.negativeZEdge !== undefined &&
    (result.negativeZEdge === undefined || result.negativeZEdge === DEFAULT_FLOOR.negativeZEdge)
  ) {
    ensureSceneClone();
    result.negativeZEdge = floorTheme.negativeZEdge;
  }
  if (
    floorTheme.negativeZFadeDistance !== undefined &&
    (result.negativeZFadeDistance === undefined ||
      result.negativeZFadeDistance === DEFAULT_FLOOR.negativeZFadeDistance)
  ) {
    ensureSceneClone();
    result.negativeZFadeDistance = floorTheme.negativeZFadeDistance;
  }

  const gridTheme = floorTheme.grid;
  const surface = result.surface;
  if (!gridTheme || !surface || surface.type !== 'physical' || surface.pattern !== 'grid') {
    return result;
  }

  let surfaceChanged = false;
  const themedSurface: FloorSurfacePhysical = {...surface};
  const setSurfaceDefault = <K extends keyof FloorSurfacePhysical>(
    key: K,
    themedValue: FloorSurfacePhysical[K] | undefined,
    defaultValue: FloorSurfacePhysical[K],
  ): void => {
    if (themedValue === undefined) return;
    const current = themedSurface[key];
    if (current === undefined || current === defaultValue) {
      themedSurface[key] = themedValue;
      surfaceChanged = true;
    }
  };

  setSurfaceDefault('gridCellSize', gridTheme.spacing, DEFAULT_GRID_SURFACE.gridCellSize);
  setSurfaceDefault('gridColor', gridTheme.lineColor, DEFAULT_GRID_SURFACE.gridColor);
  setSurfaceDefault('gridMajorColor', gridTheme.majorLineColor, DEFAULT_GRID_SURFACE.gridMajorColor);
  setSurfaceDefault('color', gridTheme.fillColor, DEFAULT_GRID_SURFACE.color);
  setSurfaceDefault('gridLineOpacity', gridTheme.lineOpacity, DEFAULT_GRID_SURFACE.gridLineOpacity);
  setSurfaceDefault('gridFillOpacity', gridTheme.fillOpacity, DEFAULT_GRID_SURFACE.gridFillOpacity);
  setSurfaceDefault('gridMajorEvery', gridTheme.majorEvery, DEFAULT_GRID_SURFACE.gridMajorEvery);
  setSurfaceDefault('opacity', gridTheme.fillOpacity, DEFAULT_GRID_SURFACE.opacity);

  if (!surfaceChanged) return result;
  ensureSceneClone();
  result.surface = themedSurface;
  return result;
};

export class FloorWidget
  implements ISceneElement<SceneFloor>, IRenderable<SceneFloor>, IDslComposite, IHasCustomDslHandler {
  // Ambient: Floor configures the scene globally. Not an NVS-bounded canvas element.
  readonly nodeHandlerCategory = 'ambient' as const;
  readonly widgetId = 'floor';
  readonly defaultState: SceneFloor = DEFAULT_FLOOR;
  readonly transitionSpec = functionalFloorTransitionSpec;
  readonly DslComponent = Floor as React.ComponentType<Partial<SceneFloor> & { children?: React.ReactNode }>;
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    {component: FloorPhysical as React.ComponentType<unknown>, displayName: 'FloorPhysical', topLevelError: true},
    {component: FloorMirror as React.ComponentType<unknown>, displayName: 'FloorMirror', topLevelError: true},
  ];

  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const props = node.props as FloorProps;
    const children = helpers.collectChildren(node);
    let surface: FloorSurface | undefined;
    const theme = helpers.resolveValue(props.theme, api.context) as FloorProps['theme'] | undefined;
    const floorTheme = theme?.floor;
    const gridTheme = theme?.floor?.grid;
    const gridThemeOverrides: Partial<FloorSurfacePhysical> | undefined = gridTheme
      ? {
        color: gridTheme.fillColor,
        gridColor: gridTheme.lineColor,
        gridMajorColor: gridTheme.majorLineColor,
        gridCellSize: gridTheme.spacing,
        gridMajorEvery: gridTheme.majorEvery,
        gridLineOpacity: gridTheme.lineOpacity,
        gridFillOpacity: gridTheme.fillOpacity,
        opacity: gridTheme.fillOpacity,
      }
      : undefined;

    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as React.ReactElement;
      if (childEl.type === FloorPhysical) {
        const resolved = helpers.resolveObjectValues(
          childEl.props as FloorPhysicalProps,
          api.context,
        ) as FloorPhysicalProps;
        if (resolved.pattern === 'grid') {
          surface = {
            ...DEFAULT_GRID_SURFACE,
            ...gridThemeOverrides,
            type: 'physical',
            ...resolved,
          } as FloorSurfacePhysical;
        } else {
          surface = {type: 'physical', ...resolved} as FloorSurfacePhysical;
        }
      } else if (childEl.type === FloorMirror) {
        const resolved = helpers.resolveObjectValues(childEl.props as FloorMirrorProps, api.context);
        surface = {type: 'mirror', ...resolved} as FloorSurfaceMirror;
      }
    }

    const base = (api.state.widgets[this.widgetId] as SceneFloor | undefined) ?? DEFAULT_FLOOR;
    const variant = helpers.resolveValue(props.variant, api.context) ?? 'grid';
    const fallbackSurface: FloorSurface =
      variant === 'mirror'
        ? DEFAULT_MIRROR_SURFACE
        : variant === 'physical'
          ? DEFAULT_PHYSICAL_SURFACE
          : {
            ...DEFAULT_GRID_SURFACE,
            ...gridThemeOverrides,
          };
    const resolved: SceneFloor = {
      ...base,
      enabled: helpers.resolveValue(props.enabled, api.context) ?? base.enabled,
      debug: helpers.resolveValue(props.debug, api.context) ?? base.debug,
      placement: helpers.resolveValue(props.placement, api.context) ?? base.placement,
      position: helpers.resolveValue(props.position, api.context) ?? base.position,
      rotation: helpers.resolveValue(props.rotation, api.context) ?? base.rotation,
      rotationRelative:
        helpers.resolveValue(props.rotationRelative, api.context) ?? base.rotationRelative,
      scale: helpers.resolveValue(props.scale, api.context) ?? base.scale,
      negativeZExtent:
        helpers.resolveValue(props.negativeZExtent, api.context) ??
        floorTheme?.negativeZExtent ??
        base.negativeZExtent,
      negativeZEdge:
        helpers.resolveValue(props.negativeZEdge, api.context) ??
        floorTheme?.negativeZEdge ??
        base.negativeZEdge,
      negativeZFadeDistance:
        helpers.resolveValue(props.negativeZFadeDistance, api.context) ??
        floorTheme?.negativeZFadeDistance ??
        base.negativeZFadeDistance,
      surface: surface ?? fallbackSurface,
    };

    // Apply material preset from FloorProps shorthand → surfaceMaterial on the physical surface.
    const resolvedSurface = resolved.surface;
    if (resolvedSurface && resolvedSurface.type === 'physical') {
      const dslSurface = helpers.resolveValue(props.surface, api.context) as string | undefined;
      const surfaceMaterial = dslSurface ?? floorTheme?.surfaceMaterial ?? resolvedSurface.surfaceMaterial;
      const resolvedMaterialProps = helpers.resolveObjectValues(
        { colorMix: props.colorMix, brightness: props.brightness, saturation: props.saturation,
          contrast: props.contrast, depthMix: props.depthMix, roughnessMix: props.roughnessMix,
          tint: props.tint, texScale: props.texScale, iridescence: props.iridescence,
          iridescenceIOR: props.iridescenceIOR, iridescenceThicknessRange: props.iridescenceThicknessRange },
        api.context,
      );
      const dslMaterialApp = gatherMaterialApplicationFromResolved(resolvedMaterialProps as Record<string, unknown>);
      const materialApplication = dslMaterialApp ?? floorTheme?.materialApplication ?? resolvedSurface.materialApplication;

      if (surfaceMaterial || materialApplication) {
        resolved.surface = {
          ...resolvedSurface,
          ...(surfaceMaterial !== undefined ? { surfaceMaterial } : {}),
          ...(materialApplication !== undefined ? { materialApplication } : {}),
        };
      }
    }

    api.setWidgetState(this.widgetId, resolved);
  };

  mergeSnapshot(
    prev: SceneFloor | undefined,
    next: SceneFloor | undefined,
  ): SceneFloor | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    const base = prev ?? DEFAULT_FLOOR;
    return {
      ...base,
      ...next,
      surface: next.surface ?? base.surface,
      rotationRelative: next.rotationRelative ?? base.rotationRelative,
    } as SceneFloor;
  }

  private threeScene: THREE.Scene | null = null;
  private registryRef: WidgetRegistry | null = null;
  private lastThemeRef: SceneTheme | null | undefined = undefined;
  private lastInputStateRef: SceneFloor | undefined;
  private lastResolvedStateRef: SceneFloor | undefined;

  /** Set by corePlugin.configureRegistry() to provide material loader/manifest access. */
  setRegistry(registry: WidgetRegistry): void {
    this.registryRef = registry;
  }

  initialize({scene}: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
  }

  apply(state: SceneFloor, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    const sceneTheme =
      (
        this.threeScene.userData as Record<string, unknown>
      )[SCENE_THEME_USERDATA_KEY] as SceneTheme | null | undefined;
    const themedState =
      this.lastInputStateRef === state &&
      this.lastThemeRef === sceneTheme &&
      this.lastResolvedStateRef
        ? this.lastResolvedStateRef
        : resolveThemedFloorState(state, sceneTheme);

    this.lastInputStateRef = state;
    this.lastThemeRef = sceneTheme;
    this.lastResolvedStateRef = themedState;
    applyFloor(themedState, {
      scene: this.threeScene,
      materialLoader: this.registryRef?.getMaterialLoader(),
      materialManifest: this.registryRef?.getMaterialManifest(),
    });
  }

  dispose(): void {
    if (this.threeScene) {
      disposeFloor(this.threeScene as THREE.Scene);
    }
    this.threeScene = null;
    this.registryRef = null;
    this.lastThemeRef = undefined;
    this.lastInputStateRef = undefined;
    this.lastResolvedStateRef = undefined;
  }
}
