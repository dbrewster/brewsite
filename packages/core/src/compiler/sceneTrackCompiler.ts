import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type {
  SceneFrame,
  SceneTrack,
  SceneTrackTick,
  SceneWindow,
  SceneFrameDelta,
  SceneTrackTransitionBlock,
  CompileWarning,
  ProgressManagerSpec,
  SceneProgressProfile,
  SceneProgressSegment,
} from './sceneTrackTypes';
import { ensureSceneRegistry, resolveSceneFromDsl } from './sceneDslCompiler';
import { isFunctionalSpec } from './transitions/transitionTypes';
import type { WithTransitionConfig } from './transitions/transitionTypes';
import { makeResolver } from './transitions/transitionResolver';
import { IDENTITY_FN } from './identityFn';

const INPUT_CONTROLLER_WIDGET_ID = '__input_controller';

export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  /**
   * Number of frames per transition block.
   * blockSize = numSubTicks * numFramesPerSubTick from the engine layer.
   */
  blockSize: number;
  prefersReducedMotion?: boolean;
};

/**
 * Check if a value is a SceneFrame object.
 */
const isSceneFrame = (value: unknown): value is SceneFrame => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'id' in obj && 'scrollProgress' in obj && 'widgets' in obj;
};

/**
 * Serialize frame state for delta detection.
 */
const serialize = (value: unknown): string => {
  try {
    return JSON.stringify(value, (_key, next) => {
      if (typeof next === 'function') return '[function]';
      if (next && typeof next === 'object') {
        if ('content' in (next as Record<string, unknown>)) {
          const { content, ...rest } = next as Record<string, unknown>;
          return rest;
        }
        if ('$$typeof' in (next as Record<string, unknown>)) return '[react]';
      }
      return next;
    });
  } catch (error) {
    console.warn('[SceneTrack]', 'serialize.failed', error);
    return '';
  }
};

/**
 * Build a delta between two frame states.
 */
const buildDelta = (prev: SceneFrame | undefined, next: SceneFrame): SceneFrameDelta => {
  if (!prev) {
    return {
      widgets: next.widgets,
    };
  }
  const delta: SceneFrameDelta = {};
  if (serialize(prev.widgets) !== serialize(next.widgets)) {
    delta.widgets = next.widgets;
  }
  return delta;
};

// ─── ProgressManager Aggregation Pass ────────────────────────────────────────

const DEFAULT_PM_SPEC: ProgressManagerSpec = {
  scrollUnits: 1,
  fn: IDENTITY_FN,  // canonical reference — enables reference-equality in isUniform check
};

/**
 * Validates a ProgressManager fn at compile time.
 * Returns an array of CompileWarning (empty if valid).
 */
function validateProgressFn(
  fn: (t: number) => number,
  sceneId: string,
  sceneIndex: number,
): CompileWarning[] {
  const warnings: CompileWarning[] = [];
  const tol = 0.001;

  const v0 = fn(0);
  if (Math.abs(v0) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" violates fn(0) === 0 ` +
        `(got ${v0.toFixed(5)}). Scene boundaries will snap. ` +
        `Ensure your curve starts at 0.`,
      sceneIndex,
    });
  }

  const v1 = fn(1);
  if (Math.abs(v1 - 1) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" violates fn(1) === 1 ` +
        `(got ${v1.toFixed(5)}). Scene boundaries will snap. ` +
        `Ensure your curve ends at 1.`,
      sceneIndex,
    });
  }

  const s = [fn(0.25), fn(0.5), fn(0.75)];
  if ((s[0] ?? 0) > (s[1] ?? 0) + tol || (s[1] ?? 0) > (s[2] ?? 0) + tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" is non-monotonic ` +
        `(sampled values: ${s.map((v) => (v ?? 0).toFixed(4)).join(', ')}). ` +
        `The animation will play backward. Ensure fn is non-decreasing across [0, 1].`,
      sceneIndex,
    });
  }

  return warnings;
}

/**
 * Builds the SceneProgressProfile from compiled SceneFrames.
 * Returns undefined when the feature is unused (all defaults) — zero overhead path.
 * Emits compile warnings for last-scene declarations and invalid fn constraints.
 */
export function buildProgressProfile(
  frames: SceneFrame[],
  emitWarning: (w: CompileWarning) => void,
): SceneProgressProfile | undefined {
  const n = frames.length;
  if (n < 2) return undefined;  // 0 or 1 scenes: no transitions, no profile needed

  // Resolve each scene's spec via carry-forward.
  // CARRY-FORWARD RULES:
  //   scrollUnits and fn  → structural pacing properties, carry forward to the next
  //                         scene if that scene omits <ProgressManager>.
  //   autoAdvance         → per-scene behavioral property, does NOT carry forward.
  //                         Declaring autoAdvance on scene N only affects scene N's
  //                         outgoing transition. Scene N+1 starts without auto-advance
  //                         unless it explicitly declares its own <ProgressManager>.
  //   animationTimeScale  → same: per-scene declaration only, does NOT carry forward.
  const resolved: ProgressManagerSpec[] = [];
  let lastScrollUnits = DEFAULT_PM_SPEC.scrollUnits;
  let lastFn = DEFAULT_PM_SPEC.fn;
  for (let i = 0; i < n; i++) {
    const declared = frames[i]?.progressManager;
    if (declared !== undefined) {
      const sceneId = frames[i]?.id || `scene-${i}`;

      // Validate fn constraints
      const fnWarnings = validateProgressFn(declared.fn, sceneId ?? `scene-${i}`, i);
      fnWarnings.forEach(emitWarning);

      // Warn on last-scene declaration
      if (i === n - 1) {
        emitWarning({
          code: 'PROGRESS_MANAGER',
          message:
            `ProgressManager declared on the last scene ("${sceneId}") has no effect. ` +
            `The last scene has no outgoing transition, so scrollUnits and fn are unused. ` +
            `Remove the <ProgressManager> from this scene, or declare it on the ` +
            `second-to-last scene if you want to control that transition's weight.`,
          sceneIndex: i,
        });
      }

      lastScrollUnits = declared.scrollUnits;
      lastFn = declared.fn;
    }
    // Build resolved spec: structural props carry forward; behavioral props are per-scene only.
    const resolvedSpec: ProgressManagerSpec = { scrollUnits: lastScrollUnits, fn: lastFn };
    if (declared?.autoAdvance !== undefined) resolvedSpec.autoAdvance = declared.autoAdvance;
    if (declared?.animationTimeScale !== undefined) resolvedSpec.animationTimeScale = declared.animationTimeScale;
    resolved.push(resolvedSpec);
  }

  // Check if all specs are effectively uniform (skip mapper construction).
  // Must be false when ANY scene has autoAdvance or animationTimeScale — those features
  // require the progressProfile to be present on SceneTrack at runtime.
  // IDENTITY_FN is the same reference used by the handler's default and DEFAULT_PM_SPEC,
  // so this check is correct for both "no <ProgressManager> declared" and
  // "<ProgressManager scrollUnits={N} />" (fn omitted → IDENTITY_FN assigned).
  const firstUnit = resolved[0]?.scrollUnits ?? 1;
  const isUniform = resolved.every(
    (spec) =>
      spec.scrollUnits === firstUnit &&
      spec.fn === IDENTITY_FN &&
      spec.autoAdvance === undefined &&
      spec.animationTimeScale === undefined,
  );

  if (isUniform) return undefined;  // identity mapping — no profile needed

  // Validate autoAdvance fields per scene (only when declared)
  for (let i = 0; i < n; i++) {
    const declared = frames[i]?.progressManager;
    if (declared?.autoAdvance !== undefined) {
      const sceneId = frames[i]?.id || `scene-${i}`;
      if (declared.autoAdvance.duration <= 0) {
        emitWarning({
          code: 'PROGRESS_MANAGER',
          message:
            `ProgressManager autoAdvance.duration on scene "${sceneId}" must be > 0 ` +
            `(got ${declared.autoAdvance.duration}). Auto-advance will not fire for this scene. ` +
            `Use a positive value such as duration: 8.`,
          sceneIndex: i,
        });
      }
      const max = declared.autoAdvance.max;
      if (max <= 0 || max > 1) {
        emitWarning({
          code: 'PROGRESS_MANAGER',
          message:
            `ProgressManager autoAdvance.max on scene "${sceneId}" must be in (0, 1] ` +
            `(got ${max}). Use 0.8 to auto-advance through 80% of the scene window.`,
          sceneIndex: i,
        });
      }
      if (i === n - 1) {
        emitWarning({
          code: 'PROGRESS_MANAGER',
          message:
            `ProgressManager autoAdvance declared on the last scene ("${sceneId}") has no effect. ` +
            `The last scene has no outgoing transition window. ` +
            `Remove autoAdvance from this scene, or declare it on the second-to-last scene.`,
          sceneIndex: i,
        });
      }
    }
  }

  // Build segments (N-1 segments for N scenes, one per outgoing transition)
  // totalUnits: sum of first N-1 scenes — used for segment normalization (raw progress).
  // totalScrollUnitsAllScenes: sum of all N scenes — used by the player for scrollRegionHeightPx,
  // so that pixelsPerScene={1} means "one pixel per scrollUnit" including last-scene padding.
  const totalUnits = resolved
    .slice(0, n - 1)
    .reduce((sum, spec) => sum + spec.scrollUnits, 0);
  const totalScrollUnitsAllScenes = resolved.reduce((sum, spec) => sum + spec.scrollUnits, 0);

  const segments: SceneProgressSegment[] = [];
  let rawCursor = 0;

  for (let i = 0; i < n - 1; i++) {
    const spec = resolved[i]!;
    const normalizedWeight = spec.scrollUnits / totalUnits;
    const rawStart = rawCursor;
    const rawEnd = rawCursor + normalizedWeight;
    rawCursor = rawEnd;
    const segWidth = rawEnd - rawStart;

    const seg: SceneProgressSegment = {
      sceneIndex: i,
      rawStart,
      rawEnd,
      engineStart: i / (n - 1),
      engineEnd: (i + 1) / (n - 1),
      fn: spec.fn,
    };

    if (spec.autoAdvance !== undefined) {
      const max = spec.autoAdvance.max;
      seg.autoAdvance = {
        rawRate: (max * segWidth) / spec.autoAdvance.duration,
        maxRaw: rawStart + max * segWidth,
        pauseOnScroll: spec.autoAdvance.pauseOnScroll,
      };
    }

    if (spec.animationTimeScale !== undefined) {
      seg.animationTimeScale = spec.animationTimeScale;
    }

    segments.push(seg);
  }

  return { segments, isUniform: false, totalScrollUnits: totalScrollUnitsAllScenes };
}

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  ensureSceneRegistry();
  const { scenes, widgetRegistry, blockSize } = options;
  const warnings: CompileWarning[] = [];
  const numTransitions = scenes.length - 1;
  const totalFrames = numTransitions * blockSize + 1;
  const tickStep = totalFrames > 1 ? 1 / (totalFrames - 1) : 1;

  const makeDisabledDefault = <T>(state: T): T => {
    if (!state || typeof state !== 'object') return state;
    // Strip __transitionGroups before cloning: it contains EaseFn closures which
    // are not structuredClone-safe. The absent/disabled default never needs them.
    const stateObj = state as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __transitionGroups: _tg, ...cloneable } = stateObj;
    const clone: Record<string, unknown> =
      typeof structuredClone === 'function'
        ? structuredClone(cloneable)
        : JSON.parse(JSON.stringify(cloneable));
    if ('enabled' in clone) clone.enabled = false;
    if (clone.model && typeof clone.model === 'object' && 'enabled' in (clone.model as object)) {
      (clone.model as Record<string, unknown>).enabled = false;
    }
    return clone as T;
  };

  // ── Step 1: Evaluate each scene's DSL once at sceneProgress = 0 ─────────────
  // Each snapshot maps widgetId → authored state for widgets present in that scene.
  // Widgets absent from the scene are NOT in the snapshot — they are not inherited.
  const snapshots: SceneFrame[] = scenes.map((scene, i) => {
    const context = {
      sceneIndex: i,
      numScenes: scenes.length,
      assetsReady: true,
    };
    const raw = scene.getFrame(context);
    if (raw && typeof raw === 'object' && '$$typeof' in raw) {
      // JSX path — resolve through DSL compiler
      const { frame } = resolveSceneFromDsl(raw, context, widgetRegistry, (warning) => {
        warnings.push(warning);
      });
      return frame;
    }
    // Pre-compiled SceneFrame path
    if (isSceneFrame(raw)) return raw;
    throw new Error(
      `Scene at index ${i} getFrame() must return a JSX element or SceneFrame (got: ${typeof raw}). ` +
      'Ensure getFrame() returns <Scene ...> (or a SceneFrame object) on every code path.',
    );
  });

  // ── Step 1.5: Allow widgets to merge snapshots for persistence ─────────────
  for (const widget of widgetRegistry.getSceneElements()) {
    if (!widget.mergeSnapshot) continue;
    let prev: unknown = undefined;
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!snap) continue;
      const next = snap.widgets[widget.widgetId] as unknown;
      const merged = widget.mergeSnapshot(prev as never, next as never);
      if (merged === undefined) {
        delete snap.widgets[widget.widgetId];
      } else {
        snap.widgets[widget.widgetId] = merged as never;
      }
      prev = merged;
    }
  }

  // Scene-authored input controller is a compiler block, not a registered scene element.
  // Carry it forward so authors don't need to restate <InputController> every scene.
  let prevInputController: unknown = undefined;
  for (const snapshot of snapshots) {
    const nextInputController = snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID];
    const mergedInputController = nextInputController ?? prevInputController;
    if (mergedInputController === undefined) {
      delete snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID];
    } else {
      snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID] = mergedInputController;
    }
    prevInputController = mergedInputController;
  }

  const sceneElementWidgetIds = new Set(widgetRegistry.getSceneElements().map((w) => w.widgetId));
  const passthroughWidgetsByScene: Array<Record<string, unknown>> = snapshots.map((snapshot) =>
    Object.fromEntries(
      Object.entries(snapshot.widgets).filter(([widgetId]) => !sceneElementWidgetIds.has(widgetId)),
    ),
  );

  // ── Step 1.6: Build ProgressManager profile ──────────────────────────────────
  // Must run after snapshot evaluation (progressManager is set during DSL compile).
  const progressProfile = buildProgressProfile(snapshots, (w) => warnings.push(w));

  // ── Step 2: Allocate the flat frame array ────────────────────────────────────
  // Each frame starts with an empty widgets map. Widgets fill their own slots.
  const frames: SceneTrackTick[] = Array.from({ length: totalFrames }, (_, globalIdx) => {
    // Determine which block this frame belongs to
    const blockIdx = Math.min(Math.floor(globalIdx / blockSize), numTransitions - 1);
    const posInBlock = globalIdx - blockIdx * blockSize;
    const bp = blockSize > 1 ? posInBlock / (blockSize - 1) : 0;
    const scene = scenes[blockIdx] ?? scenes[scenes.length - 1];
    return {
      index: globalIdx,
      progress: totalFrames > 1 ? globalIdx / (totalFrames - 1) : 0,
      sceneId: scene.id,
      sceneIndex: blockIdx,
      blockProgress: bp,
      state: { id: scene.id, scrollProgress: bp, widgets: {} },
      deltaForward: {},
      deltaBackward: {},
    };
  });

  // Fix the last frame: it belongs to the final scene at blockProgress = 0
  const lastTick = frames[totalFrames - 1];
  const lastScene = scenes[scenes.length - 1];
  if (lastTick && lastScene) {
    lastTick.sceneId = lastScene.id;
    lastTick.sceneIndex = scenes.length - 1;
    lastTick.blockProgress = 0;
    lastTick.state.id = lastScene.id;
  }

  // Accumulates functional closures per block. Populated during Step 3 when a widget
  // uses FunctionalTransitionSpec instead of filling discrete frames.
  const transitionBlocks: SceneTrackTransitionBlock[] = [];

  // ── Step 3: Fill each transition block via widget batch methods ──────────────
  for (let n = 0; n < numTransitions; n++) {
    const blockStart = n * blockSize;
    const block = frames.slice(blockStart, blockStart + blockSize);
    const mid = Math.floor(blockSize / 2);
    const fromSnap = snapshots[n];
    const toSnap = snapshots[n + 1];

    if (!fromSnap || !toSnap) continue;

    for (const widget of widgetRegistry.getSceneElements()) {
      const { widgetId, defaultState, transitionSpec } = widget;
      const useDefaultWhenAbsent =
        (widget as { useDefaultStateWhenAbsent?: boolean }).useDefaultStateWhenAbsent !== false;
      const absentDefault = useDefaultWhenAbsent ? defaultState : makeDisabledDefault(defaultState);
      const fromState = fromSnap.widgets[widgetId];
      const toState = toSnap.widgets[widgetId];
      const inFrom = fromState !== undefined;
      const inTo = toState !== undefined;

      // ── Functional path ─────────────────────────────────────────────────────────
      // Widget uses FunctionalTransitionSpec: capture a closure instead of filling frames.
      // The closure calls makeResolver(bp, groups, sceneWindow, phase) to build a
      // TransitionContext, which the author's closure uses via ctx.t and ctx.channel().
      if (isFunctionalSpec(transitionSpec)) {
        if (!inFrom && !inTo) {
          // Absent from both scenes — no closure needed; fill frames discretely.
          for (const frame of block) {
            frame.state.widgets[widgetId] = absentDefault;
          }
          continue;
        }

        // Resolve scene-level windows for this transition block.
        // EXIT window: outgoing scene (fromSnap) controls when it fades out.
        // ENTER window: incoming scene (toSnap) controls when it fades in.
        // Each falls back to the widget spec's defaultWindow, then the system default.
        // Fallback matches resolveSceneTransition('dissolve', 0.8):
        //   eos=0.8, mid=(0.8+1.0)/2=0.9 → exit:[0.8,0.9], enter:[0.9,1.0]
        // This path only fires for FunctionalTransitionSpec widgets with no scene-level
        // transitionWindow AND no defaultWindow on their spec. After the DSL-layer change,
        // most scenes resolve and store a transitionWindow at compile time.
        const specDefault = transitionSpec.defaultWindow;
        const sceneExit: [number, number] =
          fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0.8, 0.9];
        const sceneEnter: [number, number] =
          toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.9, 1.0];

        // Ensure a block entry exists for index n
        const tBlock: SceneTrackTransitionBlock = transitionBlocks[n] ?? { blockIndex: n, widgetFns: {} };
        transitionBlocks[n] = tBlock;

        if (inFrom && inTo) {
          // INTERPOLATE: groups come from toState (the incoming scene drives the spec).
          const groups = (toState as WithTransitionConfig).__transitionGroups;
          const rawFn = transitionSpec.interpolateFn(fromState as never, toState as never);
          tBlock.widgetFns[widgetId] = {
            fn: (bp: number) => rawFn(makeResolver(bp, groups, [0, 1], 'interpolate')),
            kind: 'interpolate',
          };
        } else if (inFrom) {
          // EXIT: groups come from fromState; active until effectiveExitEnd.
          const groups = (fromState as WithTransitionConfig).__transitionGroups;
          const rawFn = transitionSpec.exitFn(fromState as never);
          const defaultGroup = groups?.find((g) => !g.channels);
          const effectiveExitEnd = defaultGroup?.exit?.window?.[1] ?? sceneExit[1];
          tBlock.widgetFns[widgetId] = {
            fn: (bp: number) =>
              bp >= effectiveExitEnd
                ? absentDefault
                : rawFn(makeResolver(bp, groups, sceneExit, 'exit')),
            kind: 'exit',
          };
        } else {
          // ENTER: groups come from toState; active from effectiveEnterStart.
          const groups = (toState as WithTransitionConfig).__transitionGroups;
          const rawFn = transitionSpec.enterFn(toState as never);
          const defaultGroup = groups?.find((g) => !g.channels);
          const effectiveEnterStart = defaultGroup?.enter?.window?.[0] ?? sceneEnter[0];
          tBlock.widgetFns[widgetId] = {
            fn: (bp: number) =>
              bp < effectiveEnterStart
                ? absentDefault
                : rawFn(makeResolver(bp, groups, sceneEnter, 'enter')),
            kind: 'enter',
          };
        }
        // Do NOT write to frame.state.widgets[widgetId] — left absent for runtime evaluation.
        continue;
      }

      if (inFrom && inTo) {
        // Widget present in both scenes — interpolate across the full block
        transitionSpec.interpolate(block, widgetId, fromState as never, toState as never);
      } else if (inFrom) {
        // Widget leaving — exit in first half, defaultState in second half
        transitionSpec.exit(block.slice(0, mid), widgetId, fromState as never);
        for (let i = mid; i < block.length; i++) {
          block[i]!.state.widgets[widgetId] = absentDefault;
        }
      } else if (inTo) {
        // Widget arriving — toState in first half (unless defaults suppressed), enter in second half
        const firstHalfState = useDefaultWhenAbsent ? toState : absentDefault;
        for (let i = 0; i < mid; i++) {
          block[i]!.state.widgets[widgetId] = firstHalfState as never;
        }
        transitionSpec.enter(block.slice(mid), widgetId, toState as never);
      } else {
        // Widget absent from both scenes — fill with disabled default
        for (const frame of block) {
          frame.state.widgets[widgetId] = absentDefault;
        }
      }
    }
  }

  // ── Step 4: Fill the terminal frame (+1) ────────────────────────────────────
  const terminalTick = frames[totalFrames - 1];
  const terminalSnap = snapshots[scenes.length - 1];
  if (terminalTick && terminalSnap) {
    for (const widget of widgetRegistry.getSceneElements()) {
      const useDefaultWhenAbsent =
        (widget as { useDefaultStateWhenAbsent?: boolean }).useDefaultStateWhenAbsent !== false;
      const absentDefault = useDefaultWhenAbsent
        ? widget.defaultState
        : makeDisabledDefault(widget.defaultState);
      const snapState = terminalSnap.widgets[widget.widgetId];
      terminalTick.state.widgets[widget.widgetId] = snapState ?? absentDefault;
    }
  }

  // ── Step 4.5: Preserve non-widget scene-level specs across all frames ───────
  // Examples: scene-level InputController DSL compiles to a widget-like state slot
  // but is not an actual runtime widget in WidgetRegistry. Keep these states in
  // tick.state.widgets so player/runtime layers can consume them.
  for (const frame of frames) {
    const isLast = frame.index === totalFrames - 1;
    const blockIdx = isLast
      ? snapshots.length - 1
      : Math.min(Math.floor(frame.index / blockSize), numTransitions - 1);
    const fromExtra = passthroughWidgetsByScene[blockIdx] ?? {};
    const toExtra = passthroughWidgetsByScene[blockIdx + 1] ?? fromExtra;
    const activeExtra = (isLast || frame.blockProgress < 0.5) ? fromExtra : toExtra;
    for (const [widgetId, state] of Object.entries(activeExtra)) {
      frame.state.widgets[widgetId] = state;
    }
  }

  // ── Step 5: Compile widgetExtras via compileExtra() ─────────────────────────
  // compileExtra() is called per-frame for widgets that implement it.
  for (const frame of frames) {
    const extras: Record<string, unknown> = {};
    for (const widget of widgetRegistry.getSceneElements()) {
      if (!widget.compileExtra) continue;
      // Prefer discrete state; fall back to evaluating the functional closure.
      let state: unknown = frame.state.widgets[widget.widgetId];
      if (state === undefined) {
        const tBlock = transitionBlocks[frame.sceneIndex];
        const funcOverride = tBlock?.widgetFns[widget.widgetId];
        if (funcOverride) {
          state = funcOverride.fn(frame.blockProgress);
        }
      }
      if (state === undefined) continue;
      extras[widget.widgetId] = widget.compileExtra(state as never, {
        sceneProgress: frame.blockProgress,
        globalProgress: frame.progress,
        prefersReducedMotion: options.prefersReducedMotion ?? false,
      });
    }
    if (Object.keys(extras).length > 0) frame.widgetExtras = extras;
  }

  // ── Step 6: Compute forward/backward deltas ──────────────────────────────────
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const prev = frames[i - 1];
    const next = frames[i + 1];
    frame.deltaForward = buildDelta(prev?.state, frame.state);
    frame.deltaBackward = buildDelta(next?.state, frame.state);
  }

  // ── Assemble SceneWindows ────────────────────────────────────────────────────
  const sceneWindows: SceneWindow[] = scenes.map((scene, i) => ({
    id: scene.id,
    index: i,
    start: totalFrames > 1 ? (i * blockSize) / (totalFrames - 1) : 0,
    end: totalFrames > 1
      ? Math.min(((i + 1) * blockSize) / (totalFrames - 1), 1)
      : 1,
  }));

  return {
    ticks: frames,
    tickStep,
    subTickCount: totalFrames,
    sceneWindows,
    ...(progressProfile !== undefined ? { progressProfile } : {}),
    ...(transitionBlocks.length > 0 ? { transitionBlocks } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
