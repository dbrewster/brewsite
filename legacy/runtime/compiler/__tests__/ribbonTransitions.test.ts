import {describe, expect, it} from 'vitest';
import {ribbonTransitionSpec} from '../transitions/ribbonTransitions';
import type {RibbonConfig, SceneRibbon} from '../../../model/robotSceneTypes';
import {buildContext, expectNumberClose, expectVec3Close} from './transitionTestUtils';

const buildConfig = (overrides: Partial<RibbonConfig> = {}): RibbonConfig => ({
  strandCount: 4,
  spacing: 1,
  radius: 2,
  radiusTaper: 0.5,
  segments: 10,
  twistFrequency: 1,
  twistPhase: 0.25,
  opacity: 1,
  glowLightsEnabled: true,
  glowLightCount: 2,
  glowLightIntensity: 1,
  glowLightColor: '#ffffff',
  glowLightDistance: 5,
  glowLightDecay: 1,
  curve: {
    width: 1,
    yOffset: 0.2,
    z: 0.3,
    waveAmplitude: 0.4,
    waveFrequency: 0.5,
    depthAmplitude: 0.6,
    depthFrequency: 0.7,
    depthPhase: 0.8,
  },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  ...overrides,
});

const buildRibbon = (overrides: Partial<SceneRibbon> = {}): SceneRibbon => ({
  enabled: true,
  config: buildConfig(),
  ...overrides,
});

describe('ribbon transitions', () => {
  it('blends ribbon opacity across', () => {
    const from = buildRibbon({ config: buildConfig({ opacity: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }) });
    const to = buildRibbon({ config: buildConfig({ opacity: 1, position: [2, 2, 2], rotation: [1, 1, 1], scale: [2, 2, 2] }) });
    const result = ribbonTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.config?.opacity, 0.5);
    expectVec3Close(result.config?.position, [1, 1, 1]);
    expectVec3Close(result.config?.rotation, [0.5, 0.5, 0.5]);
    expectVec3Close(result.config?.scale, [1.5, 1.5, 1.5]);
  });

  it('transitions out ribbon opacity', () => {
    const from = buildRibbon({ config: buildConfig({ opacity: 1 }) });
    const result = ribbonTransitionSpec.exit(from, buildContext({ tExit: 0.5 }));
    expectNumberClose(result.config?.opacity, 0.5);
    expect(result.enabled).toBe(true);
  });

  it('transitions in ribbon opacity', () => {
    const to = buildRibbon({ config: buildConfig({ opacity: 1 }) });
    const result = ribbonTransitionSpec.enter(to, buildContext({ tEnter: 0.5 }));
    expectNumberClose(result.config?.opacity, 0.5);
    expect(result.enabled).toBe(true);
  });

  it('blends full ribbon config scalars across', () => {
    const from = buildRibbon({ config: buildConfig({ strandCount: 1, spacing: 1, radius: 1, radiusTaper: 0, segments: 4, twistFrequency: 0, twistPhase: 0, glowLightCount: 0, glowLightIntensity: 0, glowLightDistance: 1, glowLightDecay: 1, curve: { width: 0, yOffset: 0, z: 0, waveAmplitude: 0, waveFrequency: 0, depthAmplitude: 0, depthFrequency: 0, depthPhase: 0 } }) });
    const to = buildRibbon({ config: buildConfig({ strandCount: 3, spacing: 3, radius: 5, radiusTaper: 1, segments: 8, twistFrequency: 2, twistPhase: 1, glowLightCount: 4, glowLightIntensity: 2, glowLightDistance: 3, glowLightDecay: 2, curve: { width: 2, yOffset: 2, z: 2, waveAmplitude: 2, waveFrequency: 2, depthAmplitude: 2, depthFrequency: 2, depthPhase: 2 } }) });
    const result = ribbonTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.config?.strandCount, 2);
    expectNumberClose(result.config?.spacing, 2);
    expectNumberClose(result.config?.radius, 3);
    expectNumberClose(result.config?.radiusTaper, 0.5);
    expectNumberClose(result.config?.segments, 6);
    expectNumberClose(result.config?.twistFrequency, 1);
    expectNumberClose(result.config?.twistPhase, 0.5);
    expectNumberClose(result.config?.glowLightCount, 2);
    expectNumberClose(result.config?.glowLightIntensity, 1);
    expectNumberClose(result.config?.glowLightDistance, 2);
    expectNumberClose(result.config?.glowLightDecay, 1.5);
    expectNumberClose(result.config?.curve.width, 1);
    expectNumberClose(result.config?.curve.yOffset, 1);
    expectNumberClose(result.config?.curve.z, 1);
    expectNumberClose(result.config?.curve.waveAmplitude, 1);
    expectNumberClose(result.config?.curve.waveFrequency, 1);
    expectNumberClose(result.config?.curve.depthAmplitude, 1);
    expectNumberClose(result.config?.curve.depthFrequency, 1);
    expectNumberClose(result.config?.curve.depthPhase, 1);
  });
});
