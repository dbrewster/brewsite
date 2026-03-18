/**
 * Floor element compilation.
 */

import type {
  FloorSurfaceMirror,
  FloorSurfacePhysical,
  SceneFloor,
} from './types';
import type {
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';

export const DEFAULT_GRID_SURFACE: FloorSurfacePhysical = {
  type: 'physical',
  pattern: 'grid',
  color: '#111720',
  gridColor: '#2a3442',
  gridMajorColor: '#445468',
  gridCellSize: 2,
  gridMajorEvery: 5,
  gridLineOpacity: 0.95,
  gridFillOpacity: 0,
  roughness: 0.92,
  metalness: 0.08,
  opacity: 0,
};

export const DEFAULT_MIRROR_SURFACE: FloorSurfaceMirror = {
  type: 'mirror',
  mirrorColor: '#12171f',
  mirrorOpacity: 0.9,
  shadowOpacity: 0.3,
  mirrorResolution: 1024,
  mirrorClipBias: 0.003,
};

export const DEFAULT_PHYSICAL_SURFACE: FloorSurfacePhysical = {
  type: 'physical',
  color: '#151a24',
  roughness: 0.9,
  metalness: 0.1,
  opacity: 1,
};

export const DEFAULT_FLOOR: SceneFloor = {
  enabled: true,
  debug: false,
  placement: 'sceneBase',
  position: [0, 0, 0],
  rotation: undefined,
  rotationRelative: undefined,
  scale: 1,
  negativeZExtent: undefined,
  negativeZEdge: 'hard',
  negativeZFadeDistance: undefined,
  surface: DEFAULT_GRID_SURFACE,
};

export const functionalFloorTransitionSpec: FunctionalTransitionSpec<SceneFloor> = {
  exitFn: (from) => (ctx) => ({
    placement: from.placement,
    position: from.position,
    rotation: from.rotation,
    rotationRelative: from.rotationRelative,
    scale: from.scale,
    negativeZExtent: from.negativeZExtent,
    negativeZEdge: from.negativeZEdge,
    negativeZFadeDistance: from.negativeZFadeDistance,
    surface: from.surface,
    debug: from.debug,
    enabled: from.enabled && ctx.t < 1,
  }),
  enterFn: (to) => (ctx) => ({
    placement: to.placement,
    position: to.position,
    rotation: to.rotation,
    rotationRelative: to.rotationRelative,
    scale: to.scale,
    negativeZExtent: to.negativeZExtent,
    negativeZEdge: to.negativeZEdge,
    negativeZFadeDistance: to.negativeZFadeDistance,
    surface: to.surface,
    debug: to.debug,
    enabled: to.enabled && ctx.t > 0,
  }),
  interpolateFn: (from, to) => (ctx) => ({
    placement: ctx.t < 0.5 ? from.placement : to.placement,
    position: ctx.t < 0.5 ? from.position : to.position,
    rotation: ctx.t < 0.5 ? from.rotation : to.rotation,
    rotationRelative: ctx.t < 0.5 ? from.rotationRelative : to.rotationRelative,
    scale: ctx.t < 0.5 ? from.scale : to.scale,
    negativeZExtent: ctx.t < 0.5 ? from.negativeZExtent : to.negativeZExtent,
    negativeZEdge: ctx.t < 0.5 ? from.negativeZEdge : to.negativeZEdge,
    negativeZFadeDistance:
      ctx.t < 0.5 ? from.negativeZFadeDistance : to.negativeZFadeDistance,
    surface: ctx.t < 0.5 ? from.surface : to.surface,
    debug: ctx.t < 0.5 ? from.debug : to.debug,
    enabled: (from.enabled && ctx.t < 1) || (to.enabled && ctx.t > 0),
  }),
};
