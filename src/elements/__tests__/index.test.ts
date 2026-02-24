import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LIGHTING,
  lightingTransitionSpec,
  DEFAULT_BACKGROUND,
  backgroundTransitionSpec,
  DEFAULT_ENVIRONMENT,
  environmentTransitionSpec,
  DEFAULT_FLOOR,
  floorTransitionSpec,
  DEFAULT_CAMERA,
  cameraTransitionSpec,
  applyLighting,
  applyBackground,
  applyEnvironment,
  applyFloor,
  applyCamera,
  Lighting,
  Background,
  Environment,
  Floor,
  Camera,
} from '../index';
import { DEFAULT_LIGHTING as DIRECT_LIGHTING, lightingTransitionSpec as DIRECT_LIGHTING_SPEC } from '../lighting';
import { DEFAULT_BACKGROUND as DIRECT_BACKGROUND, backgroundTransitionSpec as DIRECT_BACKGROUND_SPEC } from '../background';
import { DEFAULT_ENVIRONMENT as DIRECT_ENVIRONMENT, environmentTransitionSpec as DIRECT_ENVIRONMENT_SPEC } from '../environment';
import { DEFAULT_FLOOR as DIRECT_FLOOR, floorTransitionSpec as DIRECT_FLOOR_SPEC } from '../floor';
import { DEFAULT_CAMERA as DIRECT_CAMERA, cameraTransitionSpec as DIRECT_CAMERA_SPEC } from '../camera';

describe('elements index re-exports', () => {
  it('re-exports lighting symbols', () => {
    expect(DEFAULT_LIGHTING).toBe(DIRECT_LIGHTING);
    expect(lightingTransitionSpec).toBe(DIRECT_LIGHTING_SPEC);
    expect(typeof applyLighting).toBe('function');
    expect(typeof Lighting).toBe('function');
  });

  it('re-exports background symbols', () => {
    expect(DEFAULT_BACKGROUND).toBe(DIRECT_BACKGROUND);
    expect(backgroundTransitionSpec).toBe(DIRECT_BACKGROUND_SPEC);
    expect(typeof applyBackground).toBe('function');
    expect(typeof Background).toBe('function');
  });

  it('re-exports environment symbols', () => {
    expect(DEFAULT_ENVIRONMENT).toBe(DIRECT_ENVIRONMENT);
    expect(environmentTransitionSpec).toBe(DIRECT_ENVIRONMENT_SPEC);
    expect(typeof applyEnvironment).toBe('function');
    expect(typeof Environment).toBe('function');
  });

  it('re-exports floor symbols', () => {
    expect(DEFAULT_FLOOR).toBe(DIRECT_FLOOR);
    expect(floorTransitionSpec).toBe(DIRECT_FLOOR_SPEC);
    expect(typeof applyFloor).toBe('function');
    expect(typeof Floor).toBe('function');
  });

  it('re-exports camera symbols', () => {
    expect(DEFAULT_CAMERA).toBe(DIRECT_CAMERA);
    expect(cameraTransitionSpec).toBe(DIRECT_CAMERA_SPEC);
    expect(typeof applyCamera).toBe('function');
    expect(typeof Camera).toBe('function');
  });
});
