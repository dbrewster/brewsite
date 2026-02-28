import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type {
  SceneFrame,
  SceneTrack,
  SceneTrackTick,
  SceneWindow,
  SceneFrameDelta,
  ClipMeta,
  SceneTrackTransitionBlock,
} from './sceneTrackTypes';
import { ensureSceneRegistry, resolveSceneFromDsl } from './sceneDslCompiler';
import { compileHudItems } from './hudCompiler';
import { compileLabels } from './labelCompiler';
import { isFunctionalSpec } from './transitions/transitionTypes';

export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  /**
   * Number of frames per transition block.
   * blockSize = numSubTicks * numFramesPerSubTick from the engine layer.
   */
  blockSize: number;
  clipMeta?: ClipMeta[];
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
      hudItems: next.hudItems,
      labels: next.labels,
    };
  }
  const delta: SceneFrameDelta = {};
  if (serialize(prev.widgets) !== serialize(next.widgets)) {
    delta.widgets = next.widgets;
  }
  if (serialize(prev.hudItems) !== serialize(next.hudItems)) {
    delta.hudItems = next.hudItems;
  }
  if (serialize(prev.labels) !== serialize(next.labels)) {
    delta.labels = next.labels;
  }
  return delta;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  ensureSceneRegistry();
  const { scenes, widgetRegistry, blockSize } = options;
  const numTransitions = scenes.length - 1;
  const totalFrames = numTransitions * blockSize + 1;
  const tickStep = totalFrames > 1 ? 1 / (totalFrames - 1) : 1;

  const makeDisabledDefault = <T>(state: T): T => {
    if (!state || typeof state !== 'object') return state;
    const clone: any =
      typeof structuredClone === 'function'
        ? structuredClone(state as object)
        : JSON.parse(JSON.stringify(state));
    if ('enabled' in clone) clone.enabled = false;
    if (clone.model && typeof clone.model === 'object' && 'enabled' in clone.model) {
      clone.model.enabled = false;
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
      const { frame } = resolveSceneFromDsl(raw, context, widgetRegistry);
      return frame;
    }
    // Pre-compiled SceneFrame path
    if (isSceneFrame(raw)) return raw;
    throw new Error(
      `Scene at index ${i} getFrame() must return a JSX element or SceneFrame (got: ${typeof raw})`,
    );
  });

  const sceneElementWidgetIds = new Set(widgetRegistry.getSceneElements().map((w) => w.widgetId));
  const passthroughWidgetsByScene: Array<Record<string, unknown>> = snapshots.map((snapshot) =>
    Object.fromEntries(
      Object.entries(snapshot.widgets).filter(([widgetId]) => !sceneElementWidgetIds.has(widgetId)),
    ),
  );

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
      // The closure wraps the author's t ∈ [0,1] function with half-block remapping so
      // the runtime may call fn(tick.blockProgress) with no further transformation.
      if (isFunctionalSpec(transitionSpec)) {
        if (!inFrom && !inTo) {
          // Absent from both scenes — no closure needed; fill frames discretely.
          for (const frame of block) {
            frame.state.widgets[widgetId] = absentDefault;
          }
          continue;
        }

        // Ensure a block entry exists for index n
        const tBlock: SceneTrackTransitionBlock = transitionBlocks[n] ?? { blockIndex: n, widgetFns: {} };
        transitionBlocks[n] = tBlock;

        if (inFrom && inTo) {
          const rawFn = transitionSpec.interpolateFn(fromState as never, toState as never);
          tBlock.widgetFns[widgetId] = {
            fn: (bp: number) => rawFn(bp),
            kind: 'interpolate',
          };
        } else if (inFrom) {
          const rawFn = transitionSpec.exitFn(fromState as never);
          tBlock.widgetFns[widgetId] = {
            // Active first half: blockProgress [0, 0.5) → t [0, 1). Second half → absentDefault.
            fn: (bp: number) => (bp < 0.5 ? rawFn(bp * 2) : absentDefault),
            kind: 'exit',
          };
        } else {
          // inTo only
          const rawFn = transitionSpec.enterFn(toState as never);
          tBlock.widgetFns[widgetId] = {
            // Active second half: blockProgress [0.5, 1] → t [0, 1]. First half → absentDefault.
            fn: (bp: number) => (bp >= 0.5 ? rawFn((bp - 0.5) * 2) : absentDefault),
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
        clipMeta: options.clipMeta ?? [],
        prefersReducedMotion: options.prefersReducedMotion ?? false,
      });
    }
    if (Object.keys(extras).length > 0) frame.widgetExtras = extras;
  }

  // ── Step 6: Compile HUD items and labels ─────────────────────────────────────
  // HUD items come from the current scene snapshot (no interpolation across scenes).
  // Labels interpolate between fromSnap and toSnap using compileLabels().
  for (const frame of frames) {
    const isLast = frame.index === totalFrames - 1;
    const blockIdx = isLast ? snapshots.length - 1 : Math.min(Math.floor(frame.index / blockSize), numTransitions - 1);
    const fromSnap = snapshots[blockIdx];
    const toSnap = snapshots[blockIdx + 1];
    if (!fromSnap) continue;
    const fromHud = fromSnap.hudItems?.length
      ? compileHudItems(fromSnap.hudItems, { sceneId: fromSnap.id || `scene-${blockIdx}`, phase: 'exit' })
      : [];
    const toHud = toSnap?.hudItems?.length
      ? compileHudItems(toSnap.hudItems, { sceneId: toSnap.id || `scene-${blockIdx + 1}`, phase: 'enter' })
      : [];
    if (fromHud.length || toHud.length) {
      frame.hudPrimitives = [...fromHud, ...toHud];
    }
    if (fromSnap.labels?.length || toSnap?.labels?.length) {
      frame.labelPrimitives = compileLabels(fromSnap.labels, toSnap?.labels, { sceneProgress: frame.blockProgress });
    }
  }

  // ── Step 7: Compute forward/backward deltas ──────────────────────────────────
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
    ...(transitionBlocks.length > 0 ? { transitionBlocks } : {}),
  };
};
