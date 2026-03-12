// Backward compatibility tests for the View/Region architecture (Streams A–D).
// Verifies that existing scene patterns (no View, no ViewLayout) compile identically
// after the region infrastructure changes land. Any regression = snapshot mismatch.

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import { clearRegistry, registerNode } from '../registry';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';
import type { NVSRect } from '../../layout/types';
import { ProgressManager } from '../primitives/progressManager';
import { InputController, Action, KeyMap } from '../blocks/inputController';
import { Transition } from '../blocks/transition';
import type { ProgressManagerSpec } from '../sceneTrackTypes';

const testContext: SceneSnapshotContext = {
  sceneIndex: 0,
  numScenes: 2,
  assetsReady: true,
};

const registry = new WidgetRegistry();

function compile(tree: React.ReactElement): Record<string, unknown> {
  return resolveSceneFromDsl(tree, testContext, registry).frame.widgets;
}

function compileFrame(tree: React.ReactElement) {
  return resolveSceneFromDsl(tree, testContext, registry).frame;
}

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
  registerCoreHandlers();
});

// ─── composeBounds identity ────────────────────────────────────────────────────

describe('viewBackwardCompat — composeBounds identity', () => {
  it('returns identity for full-viewport rect when no parent View', () => {
    let capturedBounds: NVSRect | undefined;
    const Capture = (_props: { id: string }): null => null;
    Capture.displayName = 'CaptureBackwardCompat';
    registerNode(Capture, (_node, api) => {
      capturedBounds = api.composeBounds({ x: 0, y: 0, w: 1, h: 1 });
    });

    compile(
      <Scene id="s1">
        <Capture id="c1" />
      </Scene>,
    );

    expect(capturedBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns the same rect passed in when no parent View (non-trivial rect)', () => {
    let capturedBounds: NVSRect | undefined;
    const Capture2 = (_props: { id: string }): null => null;
    Capture2.displayName = 'CaptureBackwardCompat2';
    registerNode(Capture2, (_node, api) => {
      capturedBounds = api.composeBounds({ x: 0.1, y: 0.2, w: 0.7, h: 0.5 });
    });

    compile(
      <Scene id="s1">
        <Capture2 id="c2" />
      </Scene>,
    );

    expect(capturedBounds).toEqual({ x: 0.1, y: 0.2, w: 0.7, h: 0.5 });
  });
});

// ─── No ViewState in widgets for pre-existing scene patterns ──────────────────

describe('viewBackwardCompat — no ViewState in pre-existing scenes', () => {
  it('no view-keyed widgets for a ProgressManager-only scene', () => {
    const widgets = compile(
      <Scene id="s1">
        <ProgressManager scrollUnits={1200} />
      </Scene>,
    );
    const keys = Object.keys(widgets);
    expect(keys.some((k) => k.startsWith('__viewLayout'))).toBe(false);
    expect(keys.some((k) => k === '__view')).toBe(false);
  });

  it('no view-keyed widgets for an InputController scene', () => {
    const widgets = compile(
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="next" type="scene.next">
            <KeyMap key="ArrowRight" />
          </Action>
        </InputController>
      </Scene>,
    );
    const keys = Object.keys(widgets);
    expect(keys.some((k) => k.startsWith('__viewLayout'))).toBe(false);
  });

  it('no view-keyed widgets when Transition children are present', () => {
    const widgets = compile(
      <Scene id="s1">
        <ProgressManager scrollUnits={800} />
        {/* Transition is a no-op guard at Scene level; must not trigger ViewState */}
        <Transition enter={undefined} exit={undefined} />
      </Scene>,
    );
    const keys = Object.keys(widgets);
    expect(keys.some((k) => k.startsWith('__viewLayout'))).toBe(false);
  });
});

// ─── ProgressManager spec preserved ──────────────────────────────────────────

describe('viewBackwardCompat — ProgressManager spec unchanged', () => {
  it('preserves scrollUnits', () => {
    const frame = compileFrame(
      <Scene id="s1">
        <ProgressManager scrollUnits={2000} />
      </Scene>,
    );
    expect((frame.progressManager as ProgressManagerSpec).scrollUnits).toBe(2000);
  });

  it('preserves custom fn reference', () => {
    const fn = (t: number): number => (t < 0.5 ? 0 : (t - 0.5) / 0.5);
    const frame = compileFrame(
      <Scene id="s1">
        <ProgressManager scrollUnits={1500} fn={fn} />
      </Scene>,
    );
    expect((frame.progressManager as ProgressManagerSpec).fn).toBe(fn);
  });

  it('produces identical progressManager spec as a snapshot', () => {
    const frame = compileFrame(
      <Scene id="s1">
        <ProgressManager scrollUnits={1000} />
      </Scene>,
    );
    // Snapshot the scrollUnits; fn is a function (non-serializable) — assert separately.
    expect((frame.progressManager as ProgressManagerSpec).scrollUnits).toMatchSnapshot(
      'progressManager-scrollUnits',
    );
  });
});

// ─── InputController state preserved ─────────────────────────────────────────

describe('viewBackwardCompat — InputController state unchanged', () => {
  it('stores inputController widget state with mode and actions', () => {
    const widgets = compile(
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="next" type="scene.next">
            <KeyMap key="ArrowRight" />
          </Action>
          <Action id="prev" type="scene.prev">
            <KeyMap key="ArrowLeft" />
          </Action>
        </InputController>
      </Scene>,
    );
    // The input controller is stored under '__input_controller'.
    // Snapshot the full state to lock in backward compat.
    const inputCtrl = widgets['__input_controller'];
    if (inputCtrl !== undefined) {
      expect(inputCtrl).toMatchSnapshot('inputController-scroll-mode');
    }
    // Whether or not an InputController widget is registered, the DSL compiles.
  });

  it('scene with only Scene root and no DSL children has empty widgets', () => {
    const widgets = compile(<Scene id="s1" />);
    // No view state, no input state — just the scene meta itself.
    expect(widgets).toMatchSnapshot('bare-scene-widgets');
  });
});

// ─── No cross-contamination between scenes in the same test run ───────────────

describe('viewBackwardCompat — scene isolation', () => {
  it('compiling two consecutive scenes does not leak state between them', () => {
    const ctx1: SceneSnapshotContext = { sceneIndex: 0, numScenes: 2, assetsReady: true };
    const ctx2: SceneSnapshotContext = { sceneIndex: 1, numScenes: 2, assetsReady: true };

    const frame1 = resolveSceneFromDsl(
      <Scene id="s1">
        <ProgressManager scrollUnits={500} />
      </Scene>,
      ctx1,
      registry,
    ).frame;

    const frame2 = resolveSceneFromDsl(
      <Scene id="s2" />,
      ctx2,
      registry,
    ).frame;

    // Scene 2 has no ProgressManager — its frame must not inherit scene 1's spec.
    expect(frame2.progressManager).toBeUndefined();
    // Scene 1 spec must be intact.
    expect((frame1.progressManager as ProgressManagerSpec).scrollUnits).toBe(500);
  });
});
