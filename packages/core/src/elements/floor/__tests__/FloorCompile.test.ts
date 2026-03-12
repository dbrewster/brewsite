import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Floor } from '../FloorWidget';
import { DEFAULT_FLOOR, floorTransitionSpec, functionalFloorTransitionSpec } from '../compile';
import { applyFloor } from '../render';
import type { SceneFloor } from '../types';
import { makeInitContext } from '../../__tests__/elementTestMocks';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

describe('floor compile + render', () => {
  it('defaults are enabled with scene-base grid surface', () => {
    expect(DEFAULT_FLOOR.enabled).toBe(true);
    expect(DEFAULT_FLOOR.placement).toBe('sceneBase');
    expect(DEFAULT_FLOOR.surface?.type).toBe('physical');
    expect((DEFAULT_FLOOR.surface as { pattern?: string }).pattern).toBe('grid');
  });

  it('functional transitionSpec.exit disables at t=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const fn = functionalFloorTransitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.exit preserves enabled at t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(true);
  });

  it('functional transitionSpec.enter disables at t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.enter enables at t=1', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.enabled).toBe(true);
  });

  it('functional transitionSpec.interpolate at t=0 returns from state', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect((result.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
  });

  it('functional transitionSpec.interpolate at t=1 returns to state', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(1));
    expect((result.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('functional transitionSpec.interpolate switches texture at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const at25 = fn(makeSimpleContext(0.25));
    const at75 = fn(makeSimpleContext(0.75));
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('discrete transitionSpec.exit writes enabled false at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneFloor = { enabled: true };
    floorTransitionSpec.exit(frames, 'floor', from);
    expect((frames[2]!.state.widgets['floor'] as SceneFloor).enabled).toBe(false);
  });

  it('discrete transitionSpec.enter writes enabled true at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const to: SceneFloor = { enabled: true };
    floorTransitionSpec.enter(frames, 'floor', to);
    expect((frames[2]!.state.widgets['floor'] as SceneFloor).enabled).toBe(true);
  });

  it('discrete transitionSpec.interpolate switches surface at midpoint', () => {
    const frames = Array.from({ length: 5 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    floorTransitionSpec.interpolate(frames, 'floor', from, to);
    expect((frames[1]!.state.widgets['floor'] as SceneFloor).surface).toBe(from.surface);
    expect((frames[3]!.state.widgets['floor'] as SceneFloor).surface).toBe(to.surface);
  });

  it('applyFloor is a no-op stub that does not throw', () => {
    const ctx = makeInitContext();
    const state: SceneFloor = { enabled: true };
    expect(() => applyFloor(state, { scene: ctx.scene })).not.toThrow();
  });

  it('sceneBase placement anchors floor to lowest visible scene Y', () => {
    const ctx = makeInitContext();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    );
    box.position.set(0, 5, 0); // box minY = 4
    ctx.scene.add(box);

    applyFloor(
      {
        enabled: true,
        placement: 'sceneBase',
        position: [0, 0, 0],
        surface: { type: 'physical', pattern: 'grid' },
      },
      { scene: ctx.scene },
    );

    const floorMesh = ctx.scene.children.find((child) => child.name === 'Floor') as THREE.Mesh | undefined;
    expect(floorMesh).toBeDefined();
    expect(floorMesh?.position.y).toBeCloseTo(4, 4);
  });

  it('grid pattern disables env reflections by default while preserving shadows', () => {
    const ctx = makeInitContext();
    applyFloor(
      {
        enabled: true,
        surface: { type: 'physical', pattern: 'grid', color: '#ffffff', gridFillOpacity: 1 },
      },
      { scene: ctx.scene },
    );

    const floorMesh = ctx.scene.children.find((child) => child.name === 'Floor') as THREE.Mesh | undefined;
    expect(floorMesh).toBeDefined();
    const material = floorMesh?.material as THREE.MeshPhysicalMaterial | undefined;
    expect(material?.envMapIntensity).toBe(0);

    const shadowCatcher = ctx.scene.children.find((child) => child.name === 'FloorShadowCatcher') as
      | THREE.Mesh
      | undefined;
    expect(shadowCatcher).toBeDefined();
    expect(shadowCatcher?.visible).toBe(true);
  });

  it('grid pattern ignores explicit envMapIntensity and stays non-reflective', () => {
    const ctx = makeInitContext();
    applyFloor(
      {
        enabled: true,
        surface: {
          type: 'physical',
          pattern: 'grid',
          color: '#ffffff',
          gridFillOpacity: 1,
          envMapIntensity: 2,
        },
      },
      { scene: ctx.scene },
    );

    const floorMesh = ctx.scene.children.find((child) => child.name === 'Floor') as THREE.Mesh | undefined;
    expect(floorMesh).toBeDefined();
    const material = floorMesh?.material as THREE.MeshPhysicalMaterial | undefined;
    expect(material?.envMapIntensity).toBe(0);
  });

  it('grid pattern uses emissive fill so scene lighting does not tint floor color', () => {
    const ctx = makeInitContext();
    applyFloor(
      {
        enabled: true,
        surface: {
          type: 'physical',
          pattern: 'grid',
          color: '#ffffff',
          gridFillOpacity: 1,
        },
      },
      { scene: ctx.scene },
    );

    const floorMesh = ctx.scene.children.find((child) => child.name === 'Floor') as THREE.Mesh | undefined;
    expect(floorMesh).toBeDefined();
    const material = floorMesh?.material as THREE.MeshPhysicalMaterial | undefined;
    expect(material?.color.getHexString()).toBe('000000');
    expect(material?.emissive.getHexString()).toBe('ffffff');
    expect(material?.toneMapped).toBe(false);
  });

  it('Floor DSL component renders null and has displayName', () => {
    expect(Floor.displayName).toBe('Floor');
    expect(Floor({})).toBeNull();
  });
});
