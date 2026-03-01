import type { ElementTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import {
  blendNumber,
  blendVec3,
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
  position: [0, 1.4, -12],
  rotation: [0, 0, 0],
  scale: 1,
};

const applyExit = (from: NeonSignState, t: number): NeonSignState => ({
  ...from,
  enabled: t < 1 && from.enabled,
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
  enabled: t < 0.5 ? from.enabled : to.enabled,
  text: t < 0.5 ? from.text : to.text,
  fontUrl: t < 0.5 ? from.fontUrl : to.fontUrl,
  color: t < 0.5 ? from.color : to.color,
  emissiveColor: t < 0.5 ? from.emissiveColor : to.emissiveColor,
  opacity: blendNumber(from.opacity, to.opacity, t) ?? to.opacity,
  intensity: blendNumber(from.intensity, to.intensity, t) ?? to.intensity,
  position: blendVec3(from.position, to.position, t) ?? to.position,
  rotation: blendVec3(from.rotation, to.rotation, t) ?? to.rotation,
  scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
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
