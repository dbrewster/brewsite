---
title: "Core Customization Unblocking Plan"
doc_type: plan
owner: brewflow-architect
status: complete
updated: 2026-03-03
---

# Plan: Core Customization Unblocking Plan

## 1. Scope

This plan addresses all customization blockers identified in the core-module audit except the two explicitly excluded by product direction:

1. Excluded: allow multiple `<InputController>` blocks per scene.
2. Excluded: remove `ScenePlayer` client-only SSR guard.

Everything else is included in this plan.

## 2. Problems To Fix

1. Scene-authored `<InputController>` forces direct mode, preventing scroll+actions hybrid flows.
2. Controlled mode disables built-in keyboard navigation.
3. `cameraId` authored in action maps is effectively ignored unless it equals `'camera'`.
4. Primary camera action routing is fixed to a single implicit id (`camera`).
5. Scroll measurement/navigation is window-centric rather than scroll-container-centric.
6. `ScrollCaptureSection` stage-height math mishandles non-numeric CSS heights.
7. Runtime animation boost cap (`MAX_ANIM_BOOST_PER_FRAME`) is hardcoded.
8. Overlay host enter transition timing is hardcoded (`200ms ease-out`).
9. Default scroll-height behavior does not use `ProgressManager` profile units (`totalScrollUnits`).
10. Timing quality controls are split and partially implicit (`DEFAULT_BLOCK_SIZE`, `quality` presets).
11. Camera interaction behavior is overly preset-driven with hardcoded thresholds and clamps.
12. Action input defaults leak domain-specific implicit IDs (`camera`, `llm-canvas`).
13. Auto-advance docs/types/comments and runtime semantics are inconsistent.
14. JSX-based scene cache keys ignore function-body changes without explicit invalidation support.

## 3. Goals

1. Make core input and progress plumbing composable for docs sites, slide decks, and embedded page sections.
2. Convert hardcoded runtime behavior into explicit, typed engine options with safe defaults.
3. Align authored DSL expectations with runtime behavior.
4. Preserve backward compatibility by default.
5. Ship with migration notes, compile warnings, and tests that cover old and new modes.

## 4. Non-Goals

1. Introducing breaking architectural changes to the compiler/runtime layering.
2. Changing element module pattern or dependency direction.
3. Replacing scene track compilation model.
4. Implementing full multi-`<InputController>` composition in one scene.
5. Making `ScenePlayer` SSR-first.
6. Supporting multiple core `<Camera>` DSL instances in a single scene track (single render camera remains).

## 5. Deliverables

1. New input-mode policy and scroll-source abstraction in player/input layers.
2. Camera action routing via widget-level camera control contract with configurable primary target id.
3. New engine options for timing and interaction constants currently hardcoded.
4. Progress-height mode that can derive from `progressProfile.totalScrollUnits`.
5. Documentation and type/comment synchronization for auto-advance semantics.
6. Explicit scene cache invalidation API and associated developer docs.
7. Full test matrix update across `player`, `input`, `compiler`, and `runtime`.

## 6. Detailed Design

### 6.1 Input Mode Decoupling

#### 6.1.1 New policy type

Add to `packages/core/src/player/engineTypes.ts` (or new `player/inputPolicy.ts`):

```ts
export type InputModePolicy = 'auto' | 'prefer-scroll' | 'prefer-direct';
```

Add to `UseSceneEngineOptions` and `EngineProviderProps`/`ScenePlayerProps`:

```ts
inputModePolicy?: InputModePolicy; // default 'auto'
```

#### 6.1.2 Resolution behavior

Current behavior:
- `controlledProgress` OR scene input spec => direct mode.

Target behavior:
1. If `controlledProgress` is set, mode remains direct.
2. Else if `inputModePolicy === 'prefer-scroll'`, mode is scroll.
3. Else if `inputModePolicy === 'prefer-direct'`, mode is direct when scene controller exists.
4. Else (`auto`), preserve current behavior for backward compatibility.

Implementation file:
- `packages/core/src/player/useSceneEngine.ts`

#### 6.1.3 Hybrid behavior in scroll mode

When mode resolves to scroll and scene input spec exists:
1. Attach action controller for non-progress actions (camera/canvas/focus/reset).
2. Allow scene-next/scene-prev key actions to call `scrollToProgress` instead of direct progress mutations.
3. Keep wheel-based page scroll native unless explicitly mapped and prevented.

Implementation files:
- `packages/core/src/player/useEngineInput.ts`
- `packages/core/src/input/ActionInputController.ts`

### 6.2 Controlled Mode Keyboard Parity

Add options:

```ts
enableKeyboardInControlledMode?: boolean; // default false
controlledInputMap?: SceneNavInputMap; // optional override
```

Behavior:
1. If enabled, attach keyboard listeners in controlled mode.
2. Route scene navigation through `onControlledProgressChange`/controlled setters.
3. Never call `window.scrollTo` in controlled mode.

Implementation files:
- `packages/core/src/player/useEngineInput.ts`
- `packages/core/src/input/InputController.ts`

### 6.3 Camera Action Routing And Multi-Camera Support

#### 6.3.1 New camera-control widget contract

Add interface to `packages/core/src/widget/types.ts`:

```ts
export interface ICameraActionTarget {
  readonly widgetId: string;
  applyOrbit(dx: number, dy: number, speed: number): void;
  applyDolly(delta: number, speed: number): void;
  applyReset(): void;
}
```

Add a type guard in `packages/core/src/widget/WidgetRegistry.ts`:

```ts
export const isCameraActionTarget = (w: IWidget): w is ICameraActionTarget => {
  // method-presence guard
};
```

#### 6.3.2 Engine dispatch changes

Replace hardcoded `cameraId !== 'camera'` guards with explicit target resolution:
1. Resolve `effectiveCameraId = action.cameraId ?? primaryCameraId`.
2. If `effectiveCameraId === primaryCameraId`, route to the existing core scene-camera action path in `useSceneEngine`.
3. Otherwise resolve `widgetRegistry.get(effectiveCameraId)` and dispatch only when it implements `ICameraActionTarget`.
4. If target missing/invalid, warn once per id and no-op.
5. Maintain current behavior when ids are omitted (defaults still route to primary camera).

Implementation files:
- `packages/core/src/player/useSceneEngine.ts`
- `packages/core/src/widget/types.ts`
- `packages/core/src/widget/WidgetRegistry.ts`

#### 6.3.3 Primary camera id option

Add engine option:

```ts
primaryCameraId?: string; // default 'camera'
```

Use for default action-map resolution when `cameraId` missing.

#### 6.3.4 Scope boundary for this plan

To keep this plan implementable without changing core camera DSL registration:
1. This plan does not introduce multiple core `<Camera>` DSL instances.
2. Multi-target support means action routing can target any registered widget implementing `ICameraActionTarget`.
3. A future follow-up may add authored multi-camera DSL composition.

### 6.4 Scroll Source Abstraction

#### 6.4.1 New type

Add:

```ts
export type ScrollSource =
  | 'window'
  | { kind: 'element'; elementRef: RefObject<HTMLElement | null> };
```

Expose in player options:

```ts
scrollSource?: ScrollSource; // default 'window'
```

#### 6.4.2 Engine scroll hook rewrite

Refactor `useEngineScroll` to:
1. Read current scroll offset from source.
2. Register listeners on source (`window` or element).
3. Use source viewport height when computing max scroll (`window.innerHeight` vs `element.clientHeight`).
4. Use source-appropriate imperative scroll (`window.scrollTo` vs `element.scrollTo`).
5. Support late ref population (`elementRef.current` initially null) without crashing; fall back to no-op reads until available.

Implementation file:
- `packages/core/src/player/useEngineScroll.ts`

#### 6.4.3 Integration sites

Thread option through:
1. `ScenePlayerProps`
2. `EngineProviderProps`
3. `UseSceneEngineOptions`
4. `useEngineInput` call chain
5. tests for both source kinds and ref-late-mount path

### 6.5 ScrollCaptureSection Stage Height Fix

Current behavior treats string stage height as `window.innerHeight`.

Fix:
1. Measure actual sticky stage rect height (`stageRef.getBoundingClientRect().height`) every compute.
2. Use measured value for maxScroll denominator.
3. Fallback to `window.innerHeight` only when element unavailable.

Implementation file:
- `packages/core/src/player/ScrollCaptureSection.tsx`

### 6.6 Runtime Timing Tunables

#### 6.6.1 Animation boost cap option

Add in `RuntimeConfig` and thread from player options:

```ts
maxAnimBoostPerFrame?: number; // default 0.2
```

Use value in `RuntimeDriverImpl` instead of module constant.

Implementation files:
- `packages/core/src/runtime/RuntimeDriver.ts`
- `packages/core/src/player/useSceneEngine.ts`
- `packages/core/src/player/EngineProvider.tsx`
- `packages/core/src/player/ScenePlayer.tsx`

#### 6.6.2 Quality/timing consolidation

Introduce:

```ts
export type EngineTimingProfile = {
  blockSize?: number;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
};
```

Rules:
1. `blockSize` wins over `qualityPreset` mapping.
2. If neither set, preserve legacy default `10`.
3. Keep old props as deprecated pass-through aliases.

Implementation files:
- `packages/core/src/player/EngineProvider.tsx`
- `packages/core/src/player/useSceneEngine.ts`
- `packages/core/src/player/ScenePlayer.tsx`

### 6.7 Overlay Transition Configurability

Add to `EngineOverlayHostProps`:

```ts
overlayTransition?: {
  enabled?: boolean;
  durationMs?: number;
  easing?: string;
};
```

Behavior:
1. Default remains current behavior.
2. If disabled, no animation style applied.
3. If configured, apply runtime style from prop values.
4. Keep keyframe injection idempotent.
5. Add `overlayTransition` pass-through on `ScenePlayerProps`, wired to `EngineOverlayHost` in `ScenePlayerInner`.

Implementation file:
- `packages/core/src/player/EngineOverlayHost.tsx`
Integration file:
- `packages/core/src/player/ScenePlayer.tsx`

### 6.8 ProgressManager Scroll-Height Mode

Add engine option:

```ts
scrollHeightMode?: 'scene-count' | 'scroll-units'; // default 'scene-count' for compatibility
pixelsPerScrollUnit?: number; // used when scrollHeightMode='scroll-units'
```

Behavior:
1. If explicit `scrollHeightPx` provided, continue to win.
2. If `scrollHeightMode='scroll-units'` and `sceneTrack.progressProfile.totalScrollUnits` present, compute height from units.
3. If profile missing, fall back to scene-count mode.
4. Emit a runtime warning (development-only, once per engine instance) when `scroll-units` requested but profile missing.

Implementation file:
- `packages/core/src/player/useSceneEngine.ts`

### 6.9 Camera Interaction Constant Externalization

Expose configurable defaults:

```ts
cameraInteractionDefaults?: {
  wheelLockIdleMs?: number;
  wheelAxisDominance?: number;
  wheelAxisActivationThreshold?: number;
  orbitPolarMin?: number;
  orbitPolarMax?: number;
  dollyRadiusMin?: number;
  dollyRadiusMax?: number;
};
```

Thread into:
- `CameraControlsDriver`
- camera action handlers in `useSceneEngine`
- `ActionInputController` wheel lock timeout

Implementation files:
- `packages/core/src/elements/camera/render.ts`
- `packages/core/src/player/useSceneEngine.ts`
- `packages/core/src/input/ActionInputController.ts`

### 6.10 Remove Domain-Specific Implicit Action IDs

Current implicit defaults:
- camera id: `'camera'`
- canvas id: `'llm-canvas'`

Fix strategy:
1. Introduce resolver options in `ActionInputController` constructor:

```ts
idDefaults?: {
  cameraId: string;
  canvasId: string;
};
```

2. Default camera id from `primaryCameraId` option.
3. Default canvas id from new `primaryCanvasActionTargetId` option.
   - Add `primaryCanvasActionTargetId?: string` to `UseSceneEngineOptions`, `EngineProviderProps`, and `ScenePlayerProps` (default `'llm-canvas'` for compatibility during deprecation window).
4. Keep current literals only as deprecated fallback path with warning.

Implementation files:
- `packages/core/src/input/ActionInputController.ts`
- `packages/core/src/player/useEngineInput.ts`
- `packages/core/src/player/useSceneEngine.ts`

### 6.11 Auto-Advance Semantics Alignment

Unify source-of-truth semantics:
1. Runtime behavior: `pauseOnScroll=true` means disable auto-advance for current scene until scene transition.
2. Remove stale comments implying debounce-resume.
3. Update `ProgressManagerProps`, `sceneTrackTypes`, and compiler comments to match runtime.
4. Add explicit migration note if wording change could surprise authors.

Implementation files:
- `packages/core/src/compiler/primitives/progressManager.ts`
- `packages/core/src/compiler/sceneTrackTypes.ts`
- `packages/core/src/compiler/sceneTrackCompiler.ts`
- `packages/core/src/player/useSceneEngine.ts`

### 6.12 Explicit Scene Compile Cache Invalidation

Use token-based invalidation in this plan (single contract):
1. Add `invalidateCacheToken?: number | string` prop to EngineProvider/ScenePlayer.
2. Thread token to `UseSceneEngineOptions`.
3. Include token in `buildSceneTrackKey`.
4. Document host pattern: bump token when function-valued props or external closures change behavior.
5. Optional helper export in player layer:

```ts
export const nextSceneTrackCacheToken = (prev: number): number => prev + 1;
```

Implementation files:
- `packages/core/src/compiler/sceneTrackCache.ts`
- `packages/core/src/player/EngineProvider.tsx`
- `packages/core/src/player/ScenePlayer.tsx`
- `packages/core/src/player/useSceneEngine.ts`
- `packages/core/src/player/serializeJsx.ts` docs comments

## 7. Implementation Phases

### Phase 1: Input/Scroll Foundations

1. Add `InputModePolicy` and wire through provider/player/useSceneEngine.
2. Add controlled-mode keyboard opt-in and tests.
3. Implement `ScrollSource` abstraction in `useEngineScroll`.
4. Fix `ScrollCaptureSection` stage measurement.

Exit criteria:
1. Existing demos unchanged with default options.
2. New tests pass for window and element scroll sources.
3. Hybrid scroll+actions mode works under `prefer-scroll`.

### Phase 2: Camera Routing And Action IDs

1. Add `ICameraActionTarget` + type guard in widget SDK.
2. Replace hardcoded camera id checks with registry dispatch.
3. Add `primaryCameraId` and remove `llm-canvas` hidden default path.
4. Add deprecation warnings for implicit action IDs.

Exit criteria:
1. Action maps target non-default camera ids successfully.
2. Existing scene with omitted ids still works via defaults.
3. Missing/invalid camera targets produce one-time warnings without crashing input handling.

### Phase 3: Timing/Overlay/Height Controls

1. Add `maxAnimBoostPerFrame` option.
2. Add timing profile API and deprecate fragmented props.
3. Add overlay transition config props.
4. Add `scrollHeightMode='scroll-units'` support.

Exit criteria:
1. Backward-compatible timing behavior by default.
2. Scroll-units mode produces expected height from profile.

### Phase 4: Semantics Alignment And Cache Controls

1. Align auto-advance docs/types/comments with runtime.
2. Add explicit cache invalidation token wiring and key integration.
3. Update docs and migration notes.

Exit criteria:
1. No mismatched semantics in code comments/types.
2. Cache invalidation can be triggered deterministically in host apps.

## 8. File-Level Change List

### Player

1. `packages/core/src/player/useSceneEngine.ts`
2. `packages/core/src/player/useEngineInput.ts`
3. `packages/core/src/player/useEngineScroll.ts`
4. `packages/core/src/player/ScrollCaptureSection.tsx`
5. `packages/core/src/player/EngineProvider.tsx`
6. `packages/core/src/player/ScenePlayer.tsx`
7. `packages/core/src/player/EngineOverlayHost.tsx`
8. `packages/core/src/player/engineTypes.ts`

### Input

1. `packages/core/src/input/InputController.ts`
2. `packages/core/src/input/ActionInputController.ts`
3. `packages/core/src/input/types.ts`

### Camera

1. `packages/core/src/elements/camera/types.ts`
2. `packages/core/src/elements/camera/render.ts`

### Widget SDK

1. `packages/core/src/widget/types.ts`
2. `packages/core/src/widget/WidgetRegistry.ts`

### Runtime

1. `packages/core/src/runtime/RuntimeDriver.ts`

### Compiler/Cache/Docs contracts

1. `packages/core/src/compiler/primitives/progressManager.ts`
2. `packages/core/src/compiler/sceneTrackTypes.ts`
3. `packages/core/src/compiler/sceneTrackCompiler.ts`
4. `packages/core/src/compiler/sceneTrackCache.ts`
5. `packages/core/src/player/serializeJsx.ts`

### Requirements docs

1. `requirements/core/prd/prd_input.md`
2. `requirements/core/prd/prd_player_runtime.md`
3. `requirements/core/prd/prd_elements_camera.md`
4. `requirements/core/prd/prd_scene_authoring.md`

## 9. Backward Compatibility Plan

1. New behaviors are opt-in unless otherwise stated.
2. Existing props remain supported for one major cycle with deprecation notices.
3. Default values preserve current behavior.
4. New warnings are non-fatal and include migration guidance.

Deprecated paths to maintain temporarily:
1. Implicit action ids.
2. Legacy timing prop combinations (`framesPerTick`, `quality`) without unified profile.
3. Scene-count scroll-height default.

## 10. Test Plan

### 10.1 Unit tests

1. `useEngineScroll` supports both window and element scroll sources.
2. `useEngineInput` controlled-mode keyboard routing.
3. `useSceneEngine` input policy resolution matrix.
4. Camera dispatch by `cameraId` including missing-target warnings.
5. Runtime animation cap honors configurable option.
6. Overlay transition props produce expected inline animation styles.
7. Scroll-height mode calculations with and without progress profiles.
8. Action controller id-default resolution and deprecation warnings.
9. Auto-advance semantics tests updated to final documented behavior.
10. Cache token invalidates compilation key and recompiles.
11. Runtime warning in `scroll-units` mode with missing profile is emitted once in development.

### 10.2 Integration tests

1. Full-page scroll narrative remains unchanged in defaults.
2. Embedded docs-container narrative with element scroll source.
3. Hybrid scroll + scene action mappings.
4. Multi-camera action target integration.

### 10.3 Regression anchors

1. Existing `autoAdvance` regressions in `player/__tests__/autoAdvance.test.ts` remain green.
2. Existing camera interaction tests remain green with default settings.
3. No public API break in `@brewsite/core/player` exports.

## 11. Migration Notes (to publish with implementation)

1. New recommended setup for docs pages:
   - `scrollSource: { kind: 'element', elementRef: ... }`
   - `inputModePolicy: 'prefer-scroll'`
2. Controlled mode keyboard support is now opt-in.
3. If you relied on implicit `'llm-canvas'`, set explicit `canvasId` or new engine defaults.
4. For scroll-unit-accurate pages, switch to `scrollHeightMode='scroll-units'` and define `pixelsPerScrollUnit`.
5. If dynamic function props affect scene compile output, bump `invalidateCacheToken` on change.

## 12. Risks And Mitigations

1. Risk: behavioral regressions in existing scroll pages.
   - Mitigation: default-preserving options and explicit regression suite.
2. Risk: camera routing complexity across custom widgets.
   - Mitigation: narrow interface contract + runtime warnings.
3. Risk: API surface growth.
   - Mitigation: group options into structured config objects and deprecate aliases.
4. Risk: mismatch between docs and implementation reappears.
   - Mitigation: add documentation checklist to PR template for these modules.

## 13. Acceptance Criteria

1. Every issue in Section 2 (except explicitly excluded items) is resolved with code, tests, and docs updates.
2. Defaults preserve current behavior in existing example scenes.
3. New options allow:
   - nested scroll container support,
   - hybrid scroll+actions,
   - controlled-mode keyboard parity,
   - non-default camera action targeting,
   - configurable timing caps and overlay transitions,
   - scroll-unit-based height derivation,
   - deterministic compile cache invalidation.
4. Type comments, runtime comments, and observed behavior match for auto-advance semantics.

## 14. Execution Checklist

1. Implement Phase 1 and land with tests.
2. Implement Phase 2 and land with tests.
3. Implement Phase 3 and land with tests.
4. Implement Phase 4 and land with tests/docs.
5. Update PRDs listed in Section 8.
6. Run `pnpm --filter @brewsite/core test` and `pnpm --filter @brewsite/core typecheck`.
7. Validate `apps/examples` scenarios for scroll, direct, and controlled modes.
