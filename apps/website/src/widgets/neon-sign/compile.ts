import type { ElementTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import {
  blendNumber,
  transitionT,
} from '@brewsite/core/compiler/transitions/transitionTypes';
import type { NeonSignState } from './types';

export const DEFAULT_NEON_SIGN_STATE: NeonSignState = {
  enabled: false,
  opacity: 1,
  text: 'BrewSite',
  fontUrl: '/fonts/DancingScript-Bold.woff',
  color: '#00f5ff',
  emissiveColor: '#00d8ff',
  intensity: 1,
  x: 0.5,    // centered horizontally
  y: 0.5,    // centered vertically
  w: 0.6,    // 60% viewport width
  h: 0.3,    // 30% viewport height
  z: 0,      // at camera plane
  tilt: 0,   // no tilt
  yRotation: 0,
};

const applyExit = (from: NeonSignState, t: number): NeonSignState => ({
  ...from,
  enabled: t <= 1 && from.enabled,
  opacity: blendNumber(from.opacity, 0, t) ?? 0,
  intensity: blendNumber(from.intensity, 0, t) ?? 0,
});

const applyEnter = (to: NeonSignState, t: number): NeonSignState => ({
  ...to,
  enabled: t > 0 && to.enabled,
  opacity: blendNumber(0, to.opacity, t) ?? to.opacity,
  intensity: blendNumber(0, to.intensity, t) ?? to.intensity,
});

const applyInterpolate = (from: NeonSignState, to: NeonSignState, t: number): NeonSignState => ({
  ...from,
  ...to,
  // Boolean visibility should resolve to the incoming scene at midpoint.
  // This prevents "sticky" enabled state from persisting until the final frame.
  enabled: from.enabled,
  text: from.text,
  fontUrl: from.fontUrl,
  color: from.color,
  emissiveColor: from.emissiveColor,
  opacity: t <= 1 ? from.opacity : to.opacity,
  intensity: blendNumber(from.intensity, to.intensity, t) ?? to.intensity,
  x: blendNumber(from.x, to.x, t) ?? to.x,
  y: blendNumber(from.y, to.y, t) ?? to.y,
  w: blendNumber(from.w, to.w, t) ?? to.w,
  h: blendNumber(from.h, to.h, t) ?? to.h,
  z: blendNumber(from.z, to.z, t) ?? to.z,
  tilt: blendNumber(from.tilt, to.tilt, t) ?? to.tilt,
  yRotation: blendNumber(from.yRotation, to.yRotation, t) ?? to.yRotation,
});

export const neonSignTransitionSpec: ElementTransitionSpec<NeonSignState> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyExit(fromState, t);
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyEnter(toState, t);
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyInterpolate(fromState, toState, t);
    }
  },
};
