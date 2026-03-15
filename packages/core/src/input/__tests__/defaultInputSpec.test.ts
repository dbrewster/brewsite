import { describe, it, expect } from 'vitest';
import {
  createDefaultInputSpec,
  DEFAULT_INPUT_CONTROLLER_ID,
  PRIMARY_CAROUSEL_SENTINEL,
} from '../defaultInputSpec';

describe('createDefaultInputSpec', () => {
  it('returns a spec with the correct id and scope', () => {
    const spec = createDefaultInputSpec();
    expect(spec.id).toBe(DEFAULT_INPUT_CONTROLLER_ID);
    expect(spec.scope).toBe('canvas');
  });

  it('contains all 8 expected action types', () => {
    const spec = createDefaultInputSpec();
    const types = spec.actions.map((a) => a.type);
    expect(types).toContain('scene.next');
    expect(types).toContain('scene.prev');
    expect(types).toContain('camera.orbit');
    expect(types).toContain('camera.zoom');
    expect(types).toContain('camera.pan');
    expect(types).toContain('camera.reset');
    expect(types).toContain('carousel.next');
    expect(types).toContain('carousel.prev');
  });

  it('every action has a non-empty maps array', () => {
    const spec = createDefaultInputSpec();
    for (const action of spec.actions) {
      expect(action.maps.length).toBeGreaterThan(0);
    }
  });

  it('carousel actions always use PRIMARY_CAROUSEL_SENTINEL as layoutId', () => {
    const spec = createDefaultInputSpec();
    const carouselActions = spec.actions.filter(
      (a) => a.type === 'carousel.next' || a.type === 'carousel.prev',
    );
    expect(carouselActions).toHaveLength(2);
    for (const action of carouselActions) {
      expect(action.layoutId).toBe(PRIMARY_CAROUSEL_SENTINEL);
    }
  });

  it('uses default cameraId "camera" when no options provided', () => {
    const spec = createDefaultInputSpec();
    const cameraActions = spec.actions.filter((a) => a.cameraId !== undefined);
    expect(cameraActions.length).toBeGreaterThan(0);
    for (const action of cameraActions) {
      expect(action.cameraId).toBe('camera');
    }
  });

  it('propagates custom cameraId to all camera-related actions', () => {
    const spec = createDefaultInputSpec({ cameraId: 'main-camera' });
    const cameraActions = spec.actions.filter((a) => a.cameraId !== undefined);
    expect(cameraActions.length).toBeGreaterThan(0);
    for (const action of cameraActions) {
      expect(action.cameraId).toBe('main-camera');
    }
  });

  it('is pure — calling twice with same options returns equivalent results', () => {
    const spec1 = createDefaultInputSpec();
    const spec2 = createDefaultInputSpec();
    expect(spec1.id).toBe(spec2.id);
    expect(spec1.scope).toBe(spec2.scope);
    expect(spec1.actions.map((a) => a.type)).toEqual(spec2.actions.map((a) => a.type));
  });

  it('does not mutate the options object', () => {
    const options = { cameraId: 'cam' };
    const original = { ...options };
    createDefaultInputSpec(options);
    expect(options).toEqual(original);
  });

  it('scene navigation actions have no cameraId', () => {
    const spec = createDefaultInputSpec();
    const sceneActions = spec.actions.filter(
      (a) => a.type === 'scene.next' || a.type === 'scene.prev',
    );
    for (const action of sceneActions) {
      expect(action.cameraId).toBeUndefined();
    }
  });

  it('carousel actions have no cameraId', () => {
    const spec = createDefaultInputSpec();
    const carouselActions = spec.actions.filter(
      (a) => a.type === 'carousel.next' || a.type === 'carousel.prev',
    );
    for (const action of carouselActions) {
      expect(action.cameraId).toBeUndefined();
    }
  });

  it('each action has a unique id', () => {
    const spec = createDefaultInputSpec();
    const ids = spec.actions.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
