import { describe, it, expect } from 'vitest';
import {
  createDefaultInputSpec,
  DEFAULT_INPUT_CONTROLLER_ID,
  PRIMARY_CAROUSEL_SENTINEL,
} from '../defaultInputSpec';
import type { InputPointerMap, InputWheelMap } from '../types';

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

  // ── New spec design: no left-drag orbit, no unmodified WheelMap ──

  it('orbit uses meta+wheel and 2-finger touch drag — no left-drag pointer', () => {
    const spec = createDefaultInputSpec();
    const orbit = spec.actions.find((a) => a.id === 'default-camera-orbit');
    expect(orbit).toBeDefined();
    expect(orbit!.maps).toHaveLength(2);

    const wheelMap = orbit!.maps.find((m) => m.kind === 'wheel') as InputWheelMap;
    expect(wheelMap).toBeDefined();
    expect(wheelMap.modifiers).toEqual(['meta']);
    expect(wheelMap.axis).toBe('xy');

    const pointerMap = orbit!.maps.find((m) => m.kind === 'pointer') as InputPointerMap;
    expect(pointerMap).toBeDefined();
    expect(pointerMap.touches).toBe(2);
    expect(pointerMap.axis).toBe('xy');
  });

  it('no action uses an unmodified WheelMap (plain scroll is sacred)', () => {
    const spec = createDefaultInputSpec();
    for (const action of spec.actions) {
      for (const map of action.maps) {
        if (map.kind === 'wheel') {
          expect(
            (map as InputWheelMap).modifiers?.length,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no action uses left-drag pointer without modifiers', () => {
    const spec = createDefaultInputSpec();
    for (const action of spec.actions) {
      for (const map of action.maps) {
        if (map.kind === 'pointer') {
          const pm = map as InputPointerMap;
          if (pm.event === 'drag' && pm.button === 'left') {
            // Left-drag must have modifiers or touches
            expect(
              (pm.modifiers?.length ?? 0) > 0 || pm.touches !== undefined,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('zoom uses pinch only — no wheel', () => {
    const spec = createDefaultInputSpec();
    const zoom = spec.actions.find((a) => a.id === 'default-camera-zoom');
    expect(zoom).toBeDefined();
    expect(zoom!.maps).toHaveLength(1);
    expect(zoom!.maps[0]!.kind).toBe('pinch');
  });

  it('pan uses shift+wheel, middle-drag, and 3-finger touch drag', () => {
    const spec = createDefaultInputSpec();
    const pan = spec.actions.find((a) => a.id === 'default-camera-pan');
    expect(pan).toBeDefined();
    expect(pan!.maps).toHaveLength(3);

    const wheelMap = pan!.maps.find((m) => m.kind === 'wheel') as InputWheelMap;
    expect(wheelMap).toBeDefined();
    expect(wheelMap.modifiers).toEqual(['shift']);
    expect(wheelMap.axis).toBe('xy');

    const middleDrag = pan!.maps.find(
      (m) => m.kind === 'pointer' && (m as InputPointerMap).button === 'middle',
    ) as InputPointerMap;
    expect(middleDrag).toBeDefined();
    expect(middleDrag.axis).toBe('xy');

    const touchDrag = pan!.maps.find(
      (m) => m.kind === 'pointer' && (m as InputPointerMap).touches === 3,
    ) as InputPointerMap;
    expect(touchDrag).toBeDefined();
    expect(touchDrag.axis).toBe('xy');
  });

  it('camera reset maps to "r" key', () => {
    const spec = createDefaultInputSpec();
    const reset = spec.actions.find((a) => a.id === 'default-camera-reset');
    expect(reset).toBeDefined();
    expect(reset!.maps).toHaveLength(1);
    expect(reset!.maps[0]!.kind).toBe('key');
  });
});
