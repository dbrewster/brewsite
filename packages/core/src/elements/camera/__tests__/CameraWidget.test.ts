// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraWidget } from '../CameraWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import type { AnimationTickContext, RuntimeCameraOverride } from '../../../widget/types';
import type { SceneTrackTick } from '../../../compiler/sceneTrackTypes';
import type {
  ICameraInteractionDriver,
  TrackpadCameraConfig,
  Vec3,
  SceneCamera,
  CameraInteractionDriverFactory,
} from '../types';

class FakeInteractionDriver implements ICameraInteractionDriver {
  readonly calls: string[] = [];
  position: Vec3 = [0, 0, 0];
  target: Vec3 = [0, 0, 0];
  private claims = false;

  attach(_cam: unknown, _el: HTMLElement, _config: TrackpadCameraConfig): void {
    this.calls.push('attach');
  }

  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void {
    this.calls.push(smooth ? 'setLookAt:smooth' : 'setLookAt:snap');
    this.position = position;
    this.target = target;
  }

  update(_dt: number): boolean {
    this.calls.push('update');
    return false;
  }

  configure(_config: TrackpadCameraConfig): void {
    this.calls.push('configure');
  }

  claimsWheel(): boolean {
    return this.claims;
  }

  setWheelClaim(value: boolean): void {
    this.claims = value;
  }

  dispose(): void {
    this.calls.push('dispose');
  }
}

const makeCamera = (): THREE.PerspectiveCamera =>
  new THREE.PerspectiveCamera(45, 1, 0.1, 2000);

const makeScene = (): THREE.Scene => new THREE.Scene();

/** Creates a fake renderer with a real DOM element so key listeners work. */
const makeFakeRenderer = (): THREE.WebGLRenderer => {
  const domElement = document.createElement('div');
  return { domElement } as unknown as THREE.WebGLRenderer;
};

const makeTick = (
  sceneIndex: number,
  widgets: Record<string, unknown> = {},
): SceneTrackTick =>
  ({ sceneIndex, blockProgress: 0, state: { widgets } } as never);

const makeCameraState = (
  interactionEnabled: boolean,
  overrides: Partial<TrackpadCameraConfig> = {},
): SceneCamera => ({
  enabled: true,
  descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
  interaction: { enabled: interactionEnabled, ...overrides } as TrackpadCameraConfig,
});

const makeTickCtx = (
  tick: SceneTrackTick,
  scene: THREE.Scene,
  resolvedState: unknown = null,
  cameraOverride: RuntimeCameraOverride | null = null,
): AnimationTickContext => ({
  tick,
  scene,
  track: null,
  clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  variables: {} as never,
  resolvedState,
  cameraFocusTarget: null,
  cameraOverride,
  setCameraOverride: () => {},
});

const makeDriverFactory = (
  driver: FakeInteractionDriver,
  calls: { count: number },
): CameraInteractionDriverFactory =>
  (cameraObject, domElement, config) => {
    calls.count += 1;
    driver.attach(cameraObject, domElement, config);
    return driver;
  };

describe('CameraWidget', () => {
  it('custom node handler maps world props to descriptor', () => {
    const widget = new CameraWidget();
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: unknown) => void }) => void)
      | undefined;
    expect(handler).toBeDefined();
    let captured: SceneCamera | undefined;
    handler?.(
      { props: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0], fov: 50 } },
      { setWidgetState: (_id, state) => { captured = state as SceneCamera; } } as never,
    );
    expect(captured?.descriptor?.mode).toBe('world');
    expect((captured?.descriptor as { position?: Vec3 })?.position).toEqual([1, 2, 3]);
    expect(captured?.lens?.fov).toBe(50);
  });

  it('custom node handler maps orbit props to descriptor', () => {
    const widget = new CameraWidget();
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: unknown) => void }) => void)
      | undefined;
    let captured: SceneCamera | undefined;
    handler?.(
      { props: { mode: 'orbit', target: [0, 0, 0], azimuth: 1, polar: 0.5, distance: 10 } },
      { setWidgetState: (_id, state) => { captured = state as SceneCamera; } } as never,
    );
    expect(captured?.descriptor?.mode).toBe('orbit');
    expect((captured?.descriptor as { distance?: number })?.distance).toBe(10);
  });

  it('custom node handler maps fitFloorDepth props to descriptor', () => {
    const widget = new CameraWidget();
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: unknown) => void }) => void)
      | undefined;
    let captured: SceneCamera | undefined;
    handler?.(
      { props: { mode: 'fitFloorDepth', floorY: 0, floorZMin: -1, floorZMax: 1, lookAtZ: 0 } },
      { setWidgetState: (_id, state) => { captured = state as SceneCamera; } } as never,
    );
    expect(captured?.descriptor?.mode).toBe('fitFloorDepth');
  });

  it('custom node handler maps fitBotHeight props to descriptor', () => {
    const widget = new CameraWidget();
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: unknown) => void }) => void)
      | undefined;
    let captured: SceneCamera | undefined;
    handler?.(
      { props: { mode: 'fitBotHeight', targetId: 'bot', targetHeight: 2 } },
      { setWidgetState: (_id, state) => { captured = state as SceneCamera; } } as never,
    );
    expect(captured?.descriptor?.mode).toBe('fitBotHeight');
    expect((captured?.descriptor as { targetId?: string })?.targetId).toBe('bot');
  });

  it('mergeSnapshot merges descriptors when mode matches', () => {
    const widget = new CameraWidget();
    const prev: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0] },
      lens: { fov: 45, near: 0.1, far: 2000 },
    };
    const next: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [1, 0, 0], target: [0, 0, 1] },
      lens: { fov: 60 },
    };
    const merged = widget.mergeSnapshot(prev, next);
    expect(merged?.descriptor?.mode).toBe('world');
    expect((merged?.descriptor as { position?: Vec3 })?.position).toEqual([1, 0, 0]);
    expect((merged?.descriptor as { up?: Vec3 })?.up).toEqual([0, 1, 0]);
    expect(merged?.lens?.fov).toBe(60);
    expect(merged?.lens?.near).toBe(0.1);
  });

  it('mergeSnapshot prefers next descriptor when mode changes', () => {
    const widget = new CameraWidget();
    const prev: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
    };
    const next: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'orbit', target: [0, 0, 0], azimuth: 0, polar: 0, distance: 5 },
    };
    const merged = widget.mergeSnapshot(prev, next);
    expect(merged?.descriptor?.mode).toBe('orbit');
  });

  it('mergeSnapshot returns undefined when both inputs are undefined', () => {
    const widget = new CameraWidget();
    expect(widget.mergeSnapshot(undefined, undefined)).toBeUndefined();
  });

  it('mergeSnapshot returns prev when next is undefined', () => {
    const widget = new CameraWidget();
    const prev: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
    };
    expect(widget.mergeSnapshot(prev, undefined)).toEqual(prev);
  });

  it('mergeSnapshot returns next when prev is undefined', () => {
    const widget = new CameraWidget();
    const next: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
    };
    expect(widget.mergeSnapshot(undefined, next)).toEqual(next);
  });

  it('onTick returns early when tick is missing', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    widget.initialize({ scene, camera, widgetId: 'camera' });
    widget.onTick({ tick: null, scene } as AnimationTickContext);
    expect(calls.count).toBe(0);
  });

  it('onTick returns early when camera is not initialized', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const scene = makeScene();
    // No initialize() call — camera is null
    const tick = makeTick(0, {});
    widget.onTick(makeTickCtx(tick, scene));
    expect(calls.count).toBe(0);
  });

  it('interaction disabled skips driver factory and applies camera', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(false);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(calls.count).toBe(0);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
  });

  it('interaction enabled first tick attaches, snaps, configures, updates', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(calls.count).toBe(1);
    expect(driver.calls).toEqual([
      'attach',
      'setLookAt:snap',
      'update',
      'configure',
      'update',
    ]);
  });

  it('interaction enabled updates every tick', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(calls.count).toBe(1);
    expect(driver.calls.filter((call) => call === 'update')).toHaveLength(4);
    expect(driver.calls.filter((call) => call === 'configure')).toHaveLength(3);
  });

  it('interaction disabled after enabled disposes driver', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.onTick(makeTickCtx(makeTick(0), scene, makeCameraState(false)));

    expect(driver.calls).toContain('dispose');
  });

  it('scene change triggers smooth reset when enabled', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.onTick(makeTickCtx(makeTick(1), scene, state));

    expect(driver.calls).toContain('setLookAt:smooth');
  });

  it('scene change skips smooth reset when resetOnSceneChange=false', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true, { resetOnSceneChange: false });

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.onTick(makeTickCtx(makeTick(1), scene, state));

    expect(driver.calls.filter((call) => call === 'setLookAt:smooth')).toHaveLength(0);
  });

  it('isWheelClaimedByInteraction returns false when inactive', () => {
    const widget = new CameraWidget();
    expect(widget.isWheelClaimedByInteraction()).toBe(false);
  });

  it('isWheelClaimedByInteraction returns true when driver claims wheel', () => {
    const driver = new FakeInteractionDriver();
    driver.setWheelClaim(true);
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(widget.isWheelClaimedByInteraction()).toBe(true);
  });

  it('isWheelClaimedByInteraction returns false when driver does not claim wheel', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(widget.isWheelClaimedByInteraction()).toBe(false);
  });

  it('dispose while active disposes driver', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    widget.dispose();

    expect(driver.calls).toContain('dispose');
  });

  it('camera override exits interaction and applies override values', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    const override: RuntimeCameraOverride = {
      enabled: true,
      position: [9, 8, 7] as Vec3,
      target: [0, 1, 0] as Vec3,
      up: [0, 1, 0] as Vec3,
      fov: 60,
      near: 0.2,
      far: 1500,
      exposure: 1.2,
    };
    widget.onTick(makeTickCtx(makeTick(1), scene, state, override));

    expect(driver.calls).toContain('dispose');
    expect(camera.position.toArray()).toEqual([9, 8, 7]);
    expect(camera.fov).toBe(60);
  });

  it('camera override without exposure applies lens only', () => {
    const widget = new CameraWidget();
    const camera = makeCamera();
    const scene = makeScene();
    widget.initialize({ scene, camera, widgetId: 'camera' });
    const override: RuntimeCameraOverride = {
      enabled: true,
      position: [2, 3, 4] as Vec3,
      target: [0, 0, 0] as Vec3,
      fov: 70,
    };
    widget.onTick(makeTickCtx(makeTick(0), scene, null, override));
    expect(camera.position.toArray()).toEqual([2, 3, 4]);
    expect(camera.fov).toBe(70);
  });

  it('resolvedState overrides default camera state', () => {
    const widget = new CameraWidget();
    const camera = makeCamera();
    const scene = makeScene();
    widget.initialize({ scene, camera, widgetId: 'camera' });
    const resolvedState: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [9, 9, 9], target: [0, 0, 0] },
    };
    widget.onTick(makeTickCtx(makeTick(0), scene, resolvedState));
    expect(camera.position.toArray()).toEqual([9, 9, 9]);
  });

  it('interaction enabled without renderer does not create driver', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    // initialize without renderer — no domElement available
    widget.initialize({ scene, camera, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(calls.count).toBe(0);
  });

  it('reset shortcut ignores modifier mismatch', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true, { reset: { key: 'r', modifiers: ['shift'] } });

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    renderer.domElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', bubbles: true }),
    );

    expect(driver.calls.filter((call) => call === 'setLookAt:smooth')).toHaveLength(0);
  });

  it('reset shortcut with matching key resets to saved state', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true, { reset: { key: 'r' } });

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    renderer.domElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', bubbles: true }),
    );

    expect(driver.calls).toContain('setLookAt:smooth');
  });

  it('fitFloorDepth resolves lookAt defaults when entering interaction', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    camera.position.set(1, 2, 3);
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitFloorDepth', floorY: 5, floorZMin: 0, floorZMax: 10 },
      interaction: { enabled: true },
    };

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(driver.position).toEqual([camera.position.x, camera.position.y, camera.position.z]);
    expect(driver.target).toEqual([0, 5, 5]);
  });

  it('fitBotHeight without target skips initial setLookAt', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitBotHeight', targetId: 'bot', targetHeight: 1 },
      interaction: { enabled: true },
    };

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    expect(driver.calls).not.toContain('setLookAt:snap');
  });

  it('fitBotHeight with target resolves lookAt', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitBotHeight', targetId: 'bot', targetHeight: 1 },
      interaction: { enabled: true },
    };
    const tick = { ...makeTick(0), state: { widgets: { bot: { model: { position: [4, 5, 6] } } } } } as never;

    widget.onTick(makeTickCtx(tick, scene, state));

    expect(driver.target).toEqual([4, 5, 6]);
  });

  it('reset disabled does not attach key listener', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true, { reset: false });

    widget.onTick(makeTickCtx(makeTick(0), scene, state));

    renderer.domElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', bubbles: true }),
    );

    expect(driver.calls.filter((call) => call === 'setLookAt:smooth')).toHaveLength(0);
  });

  it('requestFocus stores pending override when interaction inactive', () => {
    const widget = new CameraWidget();
    const camera = makeCamera();
    const scene = makeScene();
    widget.initialize({ scene, camera, widgetId: 'camera' });

    let capturedOverride: RuntimeCameraOverride | null = null;
    const ctx: AnimationTickContext = {
      ...makeTickCtx(makeTick(0), scene),
      setCameraOverride: (override) => { capturedOverride = override; },
    };
    widget.requestFocus([1, 2, 3], [0, 0, 0], false);
    widget.onTick(ctx);

    expect(capturedOverride).not.toBeNull();
    expect(capturedOverride?.position).toEqual([1, 2, 3]);
  });

  it('requestFocus delegates to driver when interaction active', () => {
    const driver = new FakeInteractionDriver();
    const calls = { count: 0 };
    const widget = new CameraWidget(makeDriverFactory(driver, calls));
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ scene, camera, renderer, widgetId: 'camera' });
    const state = makeCameraState(true);

    widget.onTick(makeTickCtx(makeTick(0), scene, state));
    driver.calls.length = 0; // clear setup calls

    widget.requestFocus([5, 6, 7], [0, 0, 0], true);

    expect(driver.calls).toContain('setLookAt:smooth');
    expect(driver.position).toEqual([5, 6, 7]);
  });

  // ─── Orbit override same-tick application ──────────────────────────────────
  // Regression test: applyCameraOrbit sets a pending override that must be
  // applied in the SAME tick's onTick(), not deferred to the NEXT tick.
  // A one-frame delay causes the camera to alternate between the compiled
  // SceneTrack position and the orbit override position — visible as
  // ghosting/double-images during trackpad orbit.

  it('applyCameraOrbit override is applied in the same tick (no one-frame delay)', () => {
    const widget = new CameraWidget();
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ camera, renderer, scene } as never);

    // First tick: set camera to a known compiled position
    const compiledState: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 5, 10], target: [0, 0, 0] },
    };
    widget.onTick(makeTickCtx(makeTick(0, { camera: compiledState }), scene, compiledState));
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.y).toBeCloseTo(5);
    expect(camera.position.z).toBeCloseTo(10);

    // Simulate orbit input: user drags with a large delta
    widget.applyCameraOrbit(5.0, 0, 1.0);

    // Track what setCameraOverride receives
    let capturedOverride: RuntimeCameraOverride | null = null;
    const ctxWithCapture: AnimationTickContext = {
      ...makeTickCtx(makeTick(0, { camera: compiledState }), scene, compiledState),
      setCameraOverride: (o) => { capturedOverride = o; },
      cameraOverride: null, // no override from previous tick
    };

    // SAME tick after the orbit input
    widget.onTick(ctxWithCapture);

    // The override should have been stored
    expect(capturedOverride).not.toBeNull();
    expect(capturedOverride!.enabled).toBe(true);

    // AND the camera should be at the ORBIT position, NOT the compiled position.
    // The orbit moved azimuth by 0.5 * sensitivity, so camera.x should have changed.
    // If the bug is present, camera would be at the COMPILED position (0, 5, 10)
    // because the override is deferred to the next tick.
    expect(
      camera.position.x,
      'Camera X should differ from compiled position (0) — orbit was applied. ' +
      'If this equals 0, the orbit override was deferred to the next tick (ghosting bug).',
    ).not.toBeCloseTo(0, 1);
  });

  it('applyCameraOrbit override persists to subsequent ticks via cameraOverride context', () => {
    const widget = new CameraWidget();
    const camera = makeCamera();
    const scene = makeScene();
    const renderer = makeFakeRenderer();
    widget.initialize({ camera, renderer, scene } as never);

    // First tick: compiled state
    const compiledState: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 5, 10], target: [0, 0, 0] },
    };
    widget.onTick(makeTickCtx(makeTick(0, { camera: compiledState }), scene, compiledState));

    // Orbit input — large delta
    widget.applyCameraOrbit(5.0, 0, 1.0);

    // Tick 2: pending override is drained and stored
    let storedOverride: RuntimeCameraOverride | null = null;
    widget.onTick({
      ...makeTickCtx(makeTick(0, { camera: compiledState }), scene, compiledState),
      setCameraOverride: (o) => { storedOverride = o; },
      cameraOverride: null,
    });

    const orbitX = camera.position.x;

    // Tick 3: no new orbit input, but stored override comes back via context
    widget.onTick({
      ...makeTickCtx(makeTick(0, { camera: compiledState }), scene, compiledState),
      setCameraOverride: () => {},
      cameraOverride: storedOverride,
    });

    // Camera should still be at the orbit position, not snapped back to compiled
    expect(camera.position.x).toBeCloseTo(orbitX, 3);
  });
});
