// LightingWidget — ISceneElement + IRenderable + IDslComposite.
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type {
  AmbientProps,
  DirectionalProps,
  GlowPointProps,
  PointProps,
  SpotProps,
  LightStrandProps,
  WaveProps,
  CircleProps,
  RectangleProps,
  PanelProps,
  LightingProps,
} from './dsl';

export const Lighting = (_props: LightingProps): null => null;
export const Ambient = (_props: AmbientProps): null => null;
export const Directional = (_props: DirectionalProps): null => null;
export const Point = (_props: PointProps): null => null;
export const GlowPoint = (_props: GlowPointProps): null => null;
export const Spot = (_props: SpotProps): null => null;
export const LightStrand = (_props: LightStrandProps): null => null;
export const Wave = (_props: WaveProps): null => null;
export const Circle = (_props: CircleProps): null => null;
export const Rectangle = (_props: RectangleProps): null => null;
export const Panel = (_props: PanelProps): null => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
Directional.displayName = 'Directional';
Point.displayName = 'Point';
GlowPoint.displayName = 'GlowPoint';
Spot.displayName = 'Spot';
LightStrand.displayName = 'LightStrand';
Wave.displayName = 'Wave';
Circle.displayName = 'Circle';
Rectangle.displayName = 'Rectangle';
Panel.displayName = 'Panel';

import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IDslComposite,
  ILightingOverride,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneLighting, SceneLightDirectional } from './types';
import { DEFAULT_LIGHTING, functionalLightingTransitionSpec } from './compile';
import { applyLighting, setSceneLightEnabled } from './render';
import type * as React from 'react';
import { isValidElement } from 'react';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { IHasCustomDslHandler } from '../../widget/WidgetRegistry';
import type { NodeHandler, CompileApi, CompileHelpers } from '../../compiler/sceneDslTypes';
import { resolveAngle } from '../../units/resolve';

/** Mutable accumulator built up by child handlers during DSL compilation. */
type LightingChildAcc = {
  ambients: SceneLighting['ambient'][];
  directionals: SceneLightDirectional[];
  glowPoints: NonNullable<SceneLighting['glowPoint']>[];
  points: NonNullable<SceneLighting['points']>;
  spots: NonNullable<SceneLighting['spots']>;
  lightStrands: NonNullable<SceneLighting['lightStrands']>;
  panels: NonNullable<SceneLighting['panels']>;
  ambientIndex: number;
  directionalIndex: number;
  glowPointIndex: number;
  pointIndex: number;
  spotIndex: number;
};

/** Handler function for a single child DSL component inside <Lighting>. */
type ChildHandlerFn = (
  childEl: React.ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
  acc: LightingChildAcc,
) => void;

/** Resolve a LightStrand shape from its child elements (Wave, Circle, Rectangle). */
function resolveLightStrandShape(
  strandChildren: unknown[],
  helpers: CompileHelpers,
  api: CompileApi,
): NonNullable<SceneLighting['lightStrands']>[number]['shape'] | undefined {
  for (const strandChild of strandChildren) {
    if (!isValidElement(strandChild)) continue;
    const strandChildEl = strandChild as React.ReactElement;
    if (strandChildEl.type === Wave) {
      const wave = helpers.resolveObjectValues(strandChildEl.props as WaveProps, api.context) as {
        length?: number;
        width?: number;
        yOffset: number;
        z: number;
        waveAmplitude: number;
        waveFrequency: number;
        depthAmplitude: number;
        depthFrequency: number;
        depthPhase: import('../../units/types').SceneAngle;
      };
      return {
        kind: 'wave',
        curve: {
          length: wave.length ?? wave.width ?? 10,
          width: wave.width,
          yOffset: wave.yOffset,
          z: wave.z,
          waveAmplitude: wave.waveAmplitude,
          waveFrequency: wave.waveFrequency,
          depthAmplitude: wave.depthAmplitude,
          depthFrequency: wave.depthFrequency,
          depthPhase: resolveAngle(wave.depthPhase),
        },
      };
    } else if (strandChildEl.type === Circle) {
      const circle = helpers.resolveObjectValues(strandChildEl.props as CircleProps, api.context) as {
        radius: number;
        axis?: 'xy' | 'xz' | 'yz';
        offset?: [number, number, number];
      };
      return { kind: 'circle', radius: circle.radius, axis: circle.axis, offset: circle.offset };
    } else if (strandChildEl.type === Rectangle) {
      const rect = helpers.resolveObjectValues(strandChildEl.props as RectangleProps, api.context) as {
        width: number;
        height: number;
        axis?: 'xy' | 'xz' | 'yz';
        offset?: [number, number, number];
      };
      return { kind: 'rectangle', width: rect.width, height: rect.height, axis: rect.axis, offset: rect.offset };
    }
  }
  return undefined;
}

// Keyed by component function reference — NOT display name string.
// This is minification-safe and refactor-safe.
const CHILD_HANDLERS = new Map<unknown, ChildHandlerFn>([
  [Ambient, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(
      childEl.props as AmbientProps, api.context,
    ) as SceneLighting['ambient'];
    acc.ambients.push({
      ...resolved,
      id: resolved.id ?? `ambient-${acc.ambientIndex}`,
    });
    acc.ambientIndex += 1;
  }],
  [Directional, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(
      childEl.props as DirectionalProps, api.context,
    ) as SceneLightDirectional;
    acc.directionals.push({
      ...resolved,
      id: resolved.id ?? `directional-${acc.directionalIndex}`,
    });
    acc.directionalIndex += 1;
  }],
  [GlowPoint, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(
      childEl.props as GlowPointProps, api.context,
    ) as NonNullable<SceneLighting['glowPoint']>;
    acc.glowPoints.push({
      ...resolved,
      id: resolved.id ?? `glow-point-${acc.glowPointIndex}`,
    });
    acc.glowPointIndex += 1;
  }],
  [Point, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(
      childEl.props as PointProps, api.context,
    ) as NonNullable<SceneLighting['points']>[number] & { id?: string };
    acc.points.push({
      ...resolved,
      id: resolved.id ?? `point-${acc.pointIndex}`,
    });
    acc.pointIndex += 1;
  }],
  [Spot, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(
      childEl.props as SpotProps, api.context,
    ) as NonNullable<SceneLighting['spots']>[number] & { id?: string; angle: unknown };
    acc.spots.push({
      ...resolved,
      id: resolved.id ?? `spot-${acc.spotIndex}`,
      angle: resolveAngle(resolved.angle as import('../../units/types').SceneAngle),
    });
    acc.spotIndex += 1;
  }],
  [LightStrand, (childEl, api, helpers, acc) => {
    const resolved = helpers.resolveObjectValues(childEl.props as LightStrandProps, api.context) as {
      id: string;
      count: number;
      intensity: number;
      color: string;
      position?: [number, number, number];
      distance?: number;
      decay?: number;
      curve?: {
        length?: number;
        width?: number;
        yOffset: number;
        z: number;
        waveAmplitude: number;
        waveFrequency: number;
        depthAmplitude: number;
        depthFrequency: number;
        depthPhase: number;
      };
    };
    const strandChildren = helpers.collectChildren(childEl);
    let shape = resolveLightStrandShape(strandChildren, helpers, api);
    if (!shape && resolved.curve) {
      shape = {
        kind: 'wave',
        curve: {
          length: resolved.curve.length ?? resolved.curve.width ?? 10,
          width: resolved.curve.width,
          yOffset: resolved.curve.yOffset,
          z: resolved.curve.z,
          waveAmplitude: resolved.curve.waveAmplitude,
          waveFrequency: resolved.curve.waveFrequency,
          depthAmplitude: resolved.curve.depthAmplitude,
          depthFrequency: resolved.curve.depthFrequency,
          depthPhase: resolved.curve.depthPhase,
        },
      };
    }
    if (!shape) {
      console.warn(
        `[LightStrand] No shape specified for strand "${resolved.id}". ` +
        `Provide <Wave>, <Circle>, or <Rectangle> as a child, or use the deprecated "curve" prop. ` +
        `Defaulting to a zero-amplitude wave - all lights will appear stacked at the same position.`,
      );
      shape = {
        kind: 'wave',
        curve: {
          length: 10,
          yOffset: 0,
          z: 0,
          waveAmplitude: 0,
          waveFrequency: 1,
          depthAmplitude: 0,
          depthFrequency: 1,
          depthPhase: 0,
        },
      };
    }
    acc.lightStrands.push({
      id: resolved.id,
      count: resolved.count,
      intensity: resolved.intensity,
      color: resolved.color,
      position: resolved.position,
      distance: resolved.distance,
      decay: resolved.decay,
      shape,
    });
  }],
  [Panel, (childEl, api, helpers, acc) => {
    acc.panels.push(
      helpers.resolveObjectValues(childEl.props as PanelProps, api.context) as NonNullable<SceneLighting['panels']>[number],
    );
  }],
]);

export class LightingWidget
  implements ISceneElement<SceneLighting>, IRenderable<SceneLighting>, IDslComposite, IHasCustomDslHandler
{
  // Ambient: Lighting configures the scene globally. Not an NVS-bounded canvas element.
  readonly nodeHandlerCategory = 'ambient' as const;
  readonly widgetId = 'lighting';
  readonly defaultState: SceneLighting = DEFAULT_LIGHTING;
  readonly transitionSpec = functionalLightingTransitionSpec;
  // Cast: LightingProps.children is more restrictive than Partial<SceneLighting>.children?.
  readonly DslComponent = Lighting as React.ComponentType<Partial<SceneLighting> & { children?: React.ReactNode }>;
  readonly disableWhenAbsent = true;

  mergeSnapshot(
    prev: SceneLighting | undefined,
    next: SceneLighting | undefined,
  ): SceneLighting | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneLighting;
  }

  // Pattern A: child components build up SceneLighting state — not independent widgets.
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: Ambient as React.ComponentType<unknown>, displayName: 'Ambient', topLevelError: true },
    { component: Directional as React.ComponentType<unknown>, displayName: 'Directional', topLevelError: true },
    { component: GlowPoint as React.ComponentType<unknown>, displayName: 'GlowPoint', topLevelError: true },
    { component: Point as React.ComponentType<unknown>, displayName: 'Point', topLevelError: true },
    { component: Spot as React.ComponentType<unknown>, displayName: 'Spot', topLevelError: true },
    { component: LightStrand as React.ComponentType<unknown>, displayName: 'LightStrand', topLevelError: true },
    { component: Wave as React.ComponentType<unknown>, displayName: 'Wave', topLevelError: true },
    { component: Circle as React.ComponentType<unknown>, displayName: 'Circle', topLevelError: true },
    { component: Rectangle as React.ComponentType<unknown>, displayName: 'Rectangle', topLevelError: true },
    { component: Panel as React.ComponentType<unknown>, displayName: 'Panel', topLevelError: true },
  ];

  private threeScene: THREE.Scene | null = null;
  private lightingOverrideWidgets: ILightingOverride[] = [];

  /**
   * Called by corePlugin.configureRegistry() after all plugins' createWidgets() have run.
   * Does two things:
   * 1. Stores the ILightingOverride list for per-frame getLightingOverride() checks.
   * 2. Injects the per-light setter into any widget that implements receiveLightController?().
   *    This enables DiagramWidget / DiagramCanvasWidget hover callbacks to toggle individual
   *    core lights without importing setSceneLightEnabled() directly.
   */
  setLightingOverrides(overrides: ILightingOverride[]): void {
    this.lightingOverrideWidgets = overrides;
    const setter = this.setLightEnabled.bind(this);
    for (const w of overrides) {
      w.receiveLightController?.(setter);
    }
  }

  /**
   * Per-light control entry point. Called via the injected setter in hover callbacks.
   * Uses the LightingCache mechanism in render.ts so that the next applyLighting() call
   * respects the enabled/disabled state.
   */
  private setLightEnabled(lightId: string, enabled: boolean): void {
    if (!this.threeScene) return;
    setSceneLightEnabled(this.threeScene, lightId, enabled);
  }

  // WidgetRegistry routing will call this when it encounters <Lighting> in a scene.
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const props = node.props as LightingProps;
    const children = helpers.collectChildren(node);
    const acc: LightingChildAcc = {
      ambients: [], directionals: [], glowPoints: [], points: [],
      spots: [], lightStrands: [], panels: [],
      ambientIndex: 0, directionalIndex: 0, glowPointIndex: 0, pointIndex: 0, spotIndex: 0,
    };

    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as React.ReactElement;
      const handler = CHILD_HANDLERS.get(childEl.type);
      if (handler) {
        handler(childEl, api, helpers, acc);
      } else {
        const name = (childEl.type as { displayName?: string })?.displayName;
        console.warn(`[Lighting] Unexpected child component: ${name ?? 'unknown'}`);
      }
    }

    const base = (api.state.widgets[this.widgetId] as SceneLighting | undefined) ?? DEFAULT_LIGHTING;
    if (acc.ambients.length > 1) {
      console.warn(
        `[Lighting] ${acc.ambients.length} <Ambient> elements found - only the first will be used. ` +
        `Combine them into a single <Ambient> with the desired intensity and color.`,
      );
    }
    const resolvedIntensityScale = helpers.resolveValue(props.intensityScale, api.context);
    const resolvedColor = helpers.resolveValue(props.color, api.context);
    const compiled: SceneLighting = {
      ...base,
      ambient: acc.ambients[0] ?? base.ambient,
      directionals: acc.directionals.length > 0 ? acc.directionals : base.directionals,
      glowPoint: acc.glowPoints[0] ?? undefined,
      lightStrands: acc.lightStrands.length > 0 ? acc.lightStrands : [],
      points: acc.points.length > 0 ? acc.points : [],
      spots: acc.spots.length > 0 ? acc.spots : [],
      panels: acc.panels.length > 0 ? acc.panels : [],
      intensityScale: resolvedIntensityScale ?? base.intensityScale,
      color: resolvedColor ?? base.color,
    };
    api.setWidgetState(this.widgetId, compiled);
  };

  initialize({ scene }: WidgetInitContext): void {
    // Cast — IRenderable.initialize receives scene as ThreeScene via the context type
    this.threeScene = scene as THREE.Scene;
  }

  apply(state: SceneLighting, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    // Check if any peer widget is requesting full lighting suppression.
    // DiagramCanvasWidget returns { disableAll: true } when its canvas is active.
    const anyDisableAll = this.lightingOverrideWidgets.some(
      (w) => w.getLightingOverride()?.disableAll === true,
    );
    if (anyDisableAll) return; // skip all Three.js light updates this frame
    applyLighting(state, { scene: this.threeScene });
  }

  dispose(): void {
    // applyLighting removes all __managedByLightingElement lights on each apply();
    // nothing additional to dispose here.
    this.threeScene = null;
  }
}
