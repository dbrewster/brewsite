import type {ReactElement} from 'react';
import {isValidElement} from 'react';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi, CompileHelpers} from '../../runtime/compiler/sceneDslTypes';
import type {SceneLighting} from './types';

export type LightingProps = {
  intensityScale?: number;
  color?: string;
  children?: ReactElement<AmbientProps | SpotProps> | Array<ReactElement<AmbientProps | SpotProps>>;
};

export type AmbientProps = {
  intensity: number;
  color: string;
};

export type SpotProps = {
  intensity: number;
  color: string;
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  penumbra: number;
  distance: number;
  decay: number;
};

export const Lighting = (_props: LightingProps) => null;
export const Ambient = (_props: AmbientProps) => null;
export const Spot = (_props: SpotProps) => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
Spot.displayName = 'Spot';

const isSamePrimitive = (childType: unknown, primitive: { displayName?: string; name?: string }) => {
  if (childType === primitive) return true;
  if (typeof childType === 'function') {
    const typeName = (childType as { displayName?: string; name?: string }).displayName ?? (childType as { name?: string }).name;
    if (!typeName) return false;
    return typeName === primitive.displayName || typeName === primitive.name;
  }
  return false;
};

registerNode(Lighting, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const props = node.props as LightingProps;
  const ambient: AmbientProps[] = [];
  const spots: SpotProps[] = [];
  let children = props.children
  if (!children) return;
  if (!Array.isArray(children)) children = [children];
  for (const child of children) {
    if (!isValidElement(child)) continue;
    if (isSamePrimitive(child.type, Ambient)) ambient.push(child.props as AmbientProps);
    if (isSamePrimitive(child.type, Spot)) spots.push(child.props as SpotProps);
  }
  const baseLighting = api.state.lighting;
  const lighting: SceneLighting = {
    ...baseLighting,
    ambient: ambient[0]
      ? { intensity: ambient[0].intensity, color: ambient[0].color }
      : { intensity: 0, color: baseLighting.ambient.color },
    directional: { ...baseLighting.directional, intensity: 0 },
    points: [],
    panels: [],
    spots: spots.length > 0 ? spots.map((spot) => ({ ...spot })) : [],
    intensityScale: props.intensityScale ?? baseLighting.intensityScale,
    color: props.color ?? baseLighting.color,
  };
  api.setLighting(lighting);
});
