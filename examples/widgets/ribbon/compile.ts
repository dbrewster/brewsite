import type { RibbonConfig, SceneRibbon } from './types';
import type { ElementTransitionSpec } from '../../../src/compiler/transitions/transitionTypes';
import {
  blendColor,
  blendNumber,
  blendOpacity,
  blendVec3,
  transitionT,
} from '../../../src/compiler/transitions/transitionTypes';

const blendConfig = (options: {
  from?: RibbonConfig;
  to?: RibbonConfig;
  t?: number;
  fromEnabled?: boolean;
  toEnabled?: boolean;
}) => {
  const { from, to, t, fromEnabled = true, toEnabled = true } = options;
  const tValue = t ?? 0;
  if (!from && !to) return undefined;
  const base = (to ?? from) as RibbonConfig;
  if (!from || !to) return base;
  const fromOpacity = fromEnabled ? from.opacity : 0;
  const toOpacity = toEnabled ? to.opacity : 0;
  return {
    ...from,
    ...to,
    strandCount: blendNumber(from.strandCount, to.strandCount, tValue) ?? to.strandCount,
    spacing: blendNumber(from.spacing, to.spacing, tValue) ?? to.spacing,
    radius: blendNumber(from.radius, to.radius, tValue) ?? to.radius,
    radiusTaper: blendNumber(from.radiusTaper, to.radiusTaper, tValue) ?? to.radiusTaper,
    segments: blendNumber(from.segments, to.segments, tValue) ?? to.segments,
    twistFrequency: blendNumber(from.twistFrequency, to.twistFrequency, tValue) ?? to.twistFrequency,
    twistPhase: blendNumber(from.twistPhase, to.twistPhase, tValue) ?? to.twistPhase,
    opacity: blendOpacity(fromOpacity, toOpacity, tValue),
    glowLightsEnabled: tValue < 0.5 ? from.glowLightsEnabled : to.glowLightsEnabled,
    glowLightCount: blendNumber(from.glowLightCount, to.glowLightCount, tValue) ?? to.glowLightCount,
    glowLightIntensity: blendNumber(from.glowLightIntensity, to.glowLightIntensity, tValue) ?? to.glowLightIntensity,
    glowLightColor: blendColor(from.glowLightColor, to.glowLightColor, tValue) ?? to.glowLightColor,
    glowLightDistance: blendNumber(from.glowLightDistance, to.glowLightDistance, tValue) ?? to.glowLightDistance,
    glowLightDecay: blendNumber(from.glowLightDecay, to.glowLightDecay, tValue) ?? to.glowLightDecay,
    curve: from.curve && to.curve
      ? {
        ...from.curve,
        ...to.curve,
        width: blendNumber(from.curve.width, to.curve.width, tValue) ?? to.curve.width,
        yOffset: blendNumber(from.curve.yOffset, to.curve.yOffset, tValue) ?? to.curve.yOffset,
        z: blendNumber(from.curve.z, to.curve.z, tValue) ?? to.curve.z,
        waveAmplitude: blendNumber(from.curve.waveAmplitude, to.curve.waveAmplitude, tValue) ?? to.curve.waveAmplitude,
        waveFrequency: blendNumber(from.curve.waveFrequency, to.curve.waveFrequency, tValue) ?? to.curve.waveFrequency,
        depthAmplitude: blendNumber(from.curve.depthAmplitude, to.curve.depthAmplitude, tValue) ?? to.curve.depthAmplitude,
        depthFrequency: blendNumber(from.curve.depthFrequency, to.curve.depthFrequency, tValue) ?? to.curve.depthFrequency,
        depthPhase: blendNumber(from.curve.depthPhase, to.curve.depthPhase, tValue) ?? to.curve.depthPhase,
      }
      : (to.curve ?? from.curve),
    position: blendVec3(from.position, to.position, tValue) ?? to.position,
    rotation: blendVec3(from.rotation, to.rotation, tValue) ?? to.rotation,
    scale: blendVec3(from.scale, to.scale, tValue) ?? to.scale,
  } as RibbonConfig;
};

const applyRibbonExit = (from: SceneRibbon, t: number): SceneRibbon => ({
  ...from,
  enabled: t < 1 && from.enabled,
  config: from.config
    ? { ...from.config, opacity: blendOpacity(from.config.opacity, 0, t) }
    : from.config,
});

const applyRibbonEnter = (to: SceneRibbon, t: number): SceneRibbon => ({
  ...to,
  enabled: t > 0 && to.enabled,
  config: to.config
    ? { ...to.config, opacity: blendOpacity(0, to.config.opacity, t) }
    : to.config,
});

const applyRibbonInterpolate = (from: SceneRibbon, to: SceneRibbon, t: number): SceneRibbon => ({
  ...from,
  ...to,
  enabled: (() => {
    const fromActive = from.enabled;
    const toActive = to.enabled;
    if (fromActive && toActive) return t < 1 || t > 0;
    if (fromActive && !toActive) return t < 1;
    if (!fromActive && toActive) return t > 0;
    return false;
  })(),
  config: (() => {
    const fromActive = from.enabled;
    const toActive = to.enabled;
    if (fromActive && toActive) {
      return blendConfig({
        from: from.config,
        to: to.config,
        t,
        fromEnabled: true,
        toEnabled: true,
      });
    }
    if (fromActive && !toActive) {
      const base = from.config ?? to.config;
      return base
        ? { ...base, opacity: blendOpacity(from.config?.opacity ?? 0, 0, t) }
        : base;
    }
    if (!fromActive && toActive) {
      const base = to.config ?? from.config;
      return base
        ? { ...base, opacity: blendOpacity(0, to.config?.opacity ?? 0, t) }
        : base;
    }
    return from.config ?? to.config;
  })(),
});

export const ribbonTransitionSpec: ElementTransitionSpec<SceneRibbon> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyRibbonExit(fromState, t);
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyRibbonEnter(toState, t);
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyRibbonInterpolate(fromState, toState, t);
    }
  },
};
