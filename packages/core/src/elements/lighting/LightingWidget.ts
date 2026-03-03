// LightingWidget — ISceneElement + IRenderable + IDslComposite.
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneLighting } from './types';
import { DEFAULT_LIGHTING, functionalLightingTransitionSpec } from './compile';
import {
  Lighting,
  Ambient,
  Directional,
  GlowPoint,
  Point,
  Spot,
  LightStrand,
  Wave,
  Circle,
  Rectangle,
  Panel,
  type AmbientProps,
  type DirectionalProps,
  type GlowPointProps,
  type PointProps,
  type SpotProps,
  type LightStrandProps,
  type WaveProps,
  type CircleProps,
  type RectangleProps,
  type PanelProps,
  type LightingProps,
} from './dsl';
import { applyLighting } from './render';
import type * as React from 'react';
import { isValidElement } from 'react';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { IHasCustomDslHandler } from '../../widget/WidgetRegistry';
import type { NodeHandler } from '../../compiler/sceneDslTypes';

export class LightingWidget
  implements ISceneElement<SceneLighting>, IRenderable<SceneLighting>, IDslComposite, IHasCustomDslHandler
{
  readonly widgetId = 'lighting';
  readonly defaultState: SceneLighting = DEFAULT_LIGHTING;
  readonly transitionSpec = functionalLightingTransitionSpec;
  // Cast: LightingProps.children is more restrictive than Partial<SceneLighting>.children?.
  readonly DslComponent = Lighting as React.ComponentType<Partial<SceneLighting> & { children?: React.ReactNode }>;
  readonly useDefaultStateWhenAbsent = false;

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

  // WidgetRegistry routing will call this when it encounters <Lighting> in a scene.
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
      const props = node.props as LightingProps;
      const children = helpers.collectChildren(node);
      let ambientIndex = 0;
      let directionalIndex = 0;
      let glowPointIndex = 0;
      let pointIndex = 0;
      let spotIndex = 0;

      const ambients: SceneLighting['ambient'][] = [];
      const directionals: SceneLighting['directional'][] = [];
      const glowPoints: NonNullable<SceneLighting['glowPoint']>[] = [];
      const points: NonNullable<SceneLighting['points']> = [];
      const spots: NonNullable<SceneLighting['spots']> = [];
      const lightStrands: NonNullable<SceneLighting['lightStrands']> = [];
      const panels: NonNullable<SceneLighting['panels']> = [];

      for (const child of children) {
        if (!isValidElement(child)) continue;
        const childEl = child as React.ReactElement;
        if (childEl.type === Ambient) {
          const resolved = helpers.resolveObjectValues(
            childEl.props as AmbientProps,
            api.context,
          ) as SceneLighting['ambient'];
          ambients.push({
            ...resolved,
            id: resolved.id ?? `ambient-${ambientIndex}`,
          });
          ambientIndex += 1;
        } else if (childEl.type === Directional) {
          const resolved = helpers.resolveObjectValues(
            childEl.props as DirectionalProps,
            api.context,
          ) as SceneLighting['directional'];
          directionals.push({
            ...resolved,
            id: resolved.id ?? `directional-${directionalIndex}`,
          });
          directionalIndex += 1;
        } else if (childEl.type === GlowPoint) {
          const resolved = helpers.resolveObjectValues(
            childEl.props as GlowPointProps,
            api.context,
          ) as NonNullable<SceneLighting['glowPoint']>;
          glowPoints.push({
            ...resolved,
            id: resolved.id ?? `glow-point-${glowPointIndex}`,
          });
          glowPointIndex += 1;
        } else if (childEl.type === Point) {
          const resolved = helpers.resolveObjectValues(
            childEl.props as PointProps,
            api.context,
          ) as NonNullable<SceneLighting['points']>[number] & { id?: string };
          points.push({
            ...resolved,
            id: resolved.id ?? `point-${pointIndex}`,
          });
          pointIndex += 1;
        } else if (childEl.type === Spot) {
          const resolved = helpers.resolveObjectValues(
            childEl.props as SpotProps,
            api.context,
          ) as NonNullable<SceneLighting['spots']>[number] & { id?: string };
          spots.push({
            ...resolved,
            id: resolved.id ?? `spot-${spotIndex}`,
          });
          spotIndex += 1;
        } else if (childEl.type === LightStrand) {
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
          let shape: NonNullable<SceneLighting['lightStrands']>[number]['shape'] | undefined;
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
                depthPhase: number;
              };
              shape = {
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
                  depthPhase: wave.depthPhase,
                },
              };
            } else if (strandChildEl.type === Circle) {
              const circle = helpers.resolveObjectValues(strandChildEl.props as CircleProps, api.context) as {
                radius: number;
                axis?: 'xy' | 'xz' | 'yz';
                offset?: [number, number, number];
              };
              shape = { kind: 'circle', radius: circle.radius, axis: circle.axis, offset: circle.offset };
            } else if (strandChildEl.type === Rectangle) {
              const rect = helpers.resolveObjectValues(strandChildEl.props as RectangleProps, api.context) as {
                width: number;
                height: number;
                axis?: 'xy' | 'xz' | 'yz';
                offset?: [number, number, number];
              };
              shape = { kind: 'rectangle', width: rect.width, height: rect.height, axis: rect.axis, offset: rect.offset };
            }
          }
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
          lightStrands.push({
            id: resolved.id,
            count: resolved.count,
            intensity: resolved.intensity,
            color: resolved.color,
            position: resolved.position,
            distance: resolved.distance,
            decay: resolved.decay,
            shape,
          });
        } else if (childEl.type === Panel) {
          panels.push(
            helpers.resolveObjectValues(childEl.props as PanelProps, api.context) as NonNullable<SceneLighting['panels']>[number],
          );
        }
      }

      const base = (api.state.widgets[this.widgetId] as SceneLighting | undefined) ?? DEFAULT_LIGHTING;
      if (ambients.length > 1) {
        console.warn(
          `[Lighting] ${ambients.length} <Ambient> elements found - only the first will be used. ` +
          `Combine them into a single <Ambient> with the desired intensity and color.`,
        );
      }
      const resolvedIntensityScale = helpers.resolveValue(props.intensityScale, api.context);
      const resolvedColor = helpers.resolveValue(props.color, api.context);
      const compiled: SceneLighting = {
        ...base,
        ambient: ambients[0] ?? base.ambient,
        directional: directionals[0] ?? base.directional,
        glowPoint: glowPoints[0] ?? undefined,
        lightStrands: lightStrands.length > 0 ? lightStrands : [],
        points: points.length > 0 ? points : [],
        spots: spots.length > 0 ? spots : [],
        panels: panels.length > 0 ? panels : [],
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
    applyLighting(state, { scene: this.threeScene });
  }

  dispose(): void {
    // applyLighting removes all __managedByLightingElement lights on each apply();
    // nothing additional to dispose here.
    this.threeScene = null;
  }
}
