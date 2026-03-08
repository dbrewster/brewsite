// Asserts the public API surface of elements/index.ts after S2 cleanup.
import { describe, it, expect } from 'vitest';
import * as elementsBarrel from '../index';

// ─── DSL components ARE exported ──────────────────────────────────────────────
describe('elements barrel — DSL components are exported', () => {
  it('exports Lighting and its sub-components', () => {
    expect(typeof elementsBarrel.Lighting).toBe('function');
    expect(typeof elementsBarrel.Ambient).toBe('function');
    expect(typeof elementsBarrel.Directional).toBe('function');
  });

  it('exports Background', () => {
    expect(typeof elementsBarrel.Background).toBe('function');
  });

  it('exports Environment components', () => {
    expect(typeof elementsBarrel.Environment).toBe('function');
    expect(typeof elementsBarrel.EnvironmentHdri).toBe('function');
  });

  it('exports Floor components', () => {
    expect(typeof elementsBarrel.Floor).toBe('function');
  });

  it('exports Camera', () => {
    expect(typeof elementsBarrel.Camera).toBe('function');
  });

  it('exports TextBox', () => {
    expect(typeof elementsBarrel.TextBox).toBe('function');
  });
});

// ─── Render-layer internals are NOT exported ──────────────────────────────────
describe('elements barrel — render-layer internals are NOT exported', () => {
  it('does not export applyLighting', () => {
    expect((elementsBarrel as Record<string, unknown>)['applyLighting']).toBeUndefined();
  });

  it('does not export applyBackground', () => {
    expect((elementsBarrel as Record<string, unknown>)['applyBackground']).toBeUndefined();
  });

  it('does not export applyEnvironment', () => {
    expect((elementsBarrel as Record<string, unknown>)['applyEnvironment']).toBeUndefined();
  });

  it('does not export applyFloor', () => {
    expect((elementsBarrel as Record<string, unknown>)['applyFloor']).toBeUndefined();
  });

  it('does not export applyCamera', () => {
    expect((elementsBarrel as Record<string, unknown>)['applyCamera']).toBeUndefined();
  });
});

// ─── DEFAULT_ constants are NOT exported ──────────────────────────────────────
describe('elements barrel — DEFAULT_ compile-time internals are NOT exported', () => {
  it('does not export DEFAULT_LIGHTING', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_LIGHTING']).toBeUndefined();
  });

  it('does not export DEFAULT_BACKGROUND', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_BACKGROUND']).toBeUndefined();
  });

  it('does not export DEFAULT_ENVIRONMENT', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_ENVIRONMENT']).toBeUndefined();
  });

  it('does not export DEFAULT_FLOOR', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_FLOOR']).toBeUndefined();
  });

  it('does not export DEFAULT_CAMERA', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_CAMERA']).toBeUndefined();
  });

  it('does not export DEFAULT_CAMERA_DESCRIPTOR', () => {
    expect((elementsBarrel as Record<string, unknown>)['DEFAULT_CAMERA_DESCRIPTOR']).toBeUndefined();
  });
});

// ─── Legacy ElementTransitionSpec exports are NOT exported ────────────────────
describe('elements barrel — legacy transition specs are NOT exported', () => {
  it('does not export lightingTransitionSpec', () => {
    expect((elementsBarrel as Record<string, unknown>)['lightingTransitionSpec']).toBeUndefined();
  });

  it('does not export backgroundTransitionSpec', () => {
    expect((elementsBarrel as Record<string, unknown>)['backgroundTransitionSpec']).toBeUndefined();
  });

  it('does not export environmentTransitionSpec', () => {
    expect((elementsBarrel as Record<string, unknown>)['environmentTransitionSpec']).toBeUndefined();
  });

  it('does not export floorTransitionSpec', () => {
    expect((elementsBarrel as Record<string, unknown>)['floorTransitionSpec']).toBeUndefined();
  });

  it('does not export cameraTransitionSpec', () => {
    expect((elementsBarrel as Record<string, unknown>)['cameraTransitionSpec']).toBeUndefined();
  });
});
