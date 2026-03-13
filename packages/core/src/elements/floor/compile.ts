/**
 * Floor element compilation.
 */

import type {
  FloorSurfaceMirror,
  FloorSurfacePhysical,
  SceneFloor,
} from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { transitionT } from '../../compiler/transitions/transitionTypes';

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

export const floorTransitionSpec: ElementTransitionSpec<SceneFloor> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        placement: fromState.placement,
        position: fromState.position,
        rotation: fromState.rotation,
        rotationRelative: fromState.rotationRelative,
        scale: fromState.scale,
        negativeZExtent: fromState.negativeZExtent,
        negativeZEdge: fromState.negativeZEdge,
        negativeZFadeDistance: fromState.negativeZFadeDistance,
        surface: fromState.surface,
        debug: fromState.debug,
        enabled: fromState.enabled && t < 1,
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        placement: toState.placement,
        position: toState.position,
        rotation: toState.rotation,
        rotationRelative: toState.rotationRelative,
        scale: toState.scale,
        negativeZExtent: toState.negativeZExtent,
        negativeZEdge: toState.negativeZEdge,
        negativeZFadeDistance: toState.negativeZFadeDistance,
        surface: toState.surface,
        debug: toState.debug,
        enabled: toState.enabled && t > 0,
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    // Floor surfaces cannot be visually blended — hard-switch at midpoint is intentional.
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        placement: t < 0.5 ? fromState.placement : toState.placement,
        position: t < 0.5 ? fromState.position : toState.position,
        rotation: t < 0.5 ? fromState.rotation : toState.rotation,
        rotationRelative: t < 0.5 ? fromState.rotationRelative : toState.rotationRelative,
        scale: t < 0.5 ? fromState.scale : toState.scale,
        negativeZExtent: t < 0.5 ? fromState.negativeZExtent : toState.negativeZExtent,
        negativeZEdge: t < 0.5 ? fromState.negativeZEdge : toState.negativeZEdge,
        negativeZFadeDistance:
          t < 0.5 ? fromState.negativeZFadeDistance : toState.negativeZFadeDistance,
        surface: t < 0.5 ? fromState.surface : toState.surface,
        debug: t < 0.5 ? fromState.debug : toState.debug,
        enabled: (fromState.enabled && t < 1) || (toState.enabled && t > 0),
      };
    }
  },
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
