import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type { SceneFrame, SceneTrack, SceneTrackTick, SceneWindow, SceneFrameDelta, ClipMeta } from './sceneTrackTypes';
import { resolveSceneFromDsl } from './sceneDslCompiler';
import { compileAnnotations } from './annotationCompiler';
import { compileLabels } from './labelCompiler';

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
      annotations: next.annotations,
      annotationDefaults: next.annotationDefaults,
      labels: next.labels,
    };
  }
  const delta: SceneFrameDelta = {};
  if (serialize(prev.widgets) !== serialize(next.widgets)) {
    delta.widgets = next.widgets;
  }
  if (serialize(prev.annotations) !== serialize(next.annotations)) {
    delta.annotations = next.annotations;
  }
  if (serialize(prev.annotationDefaults) !== serialize(next.annotationDefaults)) {
    delta.annotationDefaults = next.annotationDefaults;
  }
  if (serialize(prev.labels) !== serialize(next.labels)) {
    delta.labels = next.labels;
  }
  return delta;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  const { scenes, widgetRegistry, blockSize } = options;
  const numTransitions = scenes.length - 1;
  const totalFrames = numTransitions * blockSize + 1;
  const tickStep = totalFrames > 1 ? 1 / (totalFrames - 1) : 1;

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
    throw new Error(`Scene "${scene.id}" getFrame must return a JSX element or SceneFrame`);
  });

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
      sceneIndex: scene.index,
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
    lastTick.sceneIndex = lastScene.index;
    lastTick.blockProgress = 0;
    lastTick.state.id = lastScene.id;
  }

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
      const fromState = fromSnap.widgets[widgetId];
      const toState = toSnap.widgets[widgetId];
      const inFrom = fromState !== undefined;
      const inTo = toState !== undefined;

      if (inFrom && inTo) {
        // Widget present in both scenes — interpolate across the full block
        transitionSpec.interpolate(block, widgetId, fromState as never, toState as never);
      } else if (inFrom) {
        // Widget leaving — exit in first half, defaultState in second half
        transitionSpec.exit(block.slice(0, mid), widgetId, fromState as never);
        for (let i = mid; i < block.length; i++) {
          block[i]!.state.widgets[widgetId] = defaultState;
        }
      } else if (inTo) {
        // Widget arriving — defaultState in first half, enter in second half
        for (let i = 0; i < mid; i++) {
          block[i]!.state.widgets[widgetId] = defaultState;
        }
        transitionSpec.enter(block.slice(mid), widgetId, toState as never);
      } else {
        // Widget absent from both scenes — fill with defaultState
        for (const frame of block) {
          frame.state.widgets[widgetId] = defaultState;
        }
      }
    }
  }

  // ── Step 4: Fill the terminal frame (+1) ────────────────────────────────────
  const terminalTick = frames[totalFrames - 1];
  const terminalSnap = snapshots[scenes.length - 1];
  if (terminalTick && terminalSnap) {
    for (const widget of widgetRegistry.getSceneElements()) {
      terminalTick.state.widgets[widget.widgetId] =
        terminalSnap.widgets[widget.widgetId] ?? widget.defaultState;
    }
  }

  // ── Step 5: Compile widgetExtras via compileExtra() ─────────────────────────
  // compileExtra() is called per-frame for widgets that implement it.
  for (const frame of frames) {
    const extras: Record<string, unknown> = {};
    for (const widget of widgetRegistry.getSceneElements()) {
      if (!widget.compileExtra) continue;
      const state = frame.state.widgets[widget.widgetId];
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

  // ── Step 6: Compile annotations and labels ───────────────────────────────────
  // These live on SceneFrame directly and are compiled per-frame from the snapshot.
  // Labels and annotations are drawn from the active scene's snapshot.
  const warnOnce = new Set<string>();
  for (const frame of frames) {
    const snap = snapshots[frame.sceneIndex] ?? snapshots[snapshots.length - 1];
    if (!snap) continue;
    if (snap.annotations?.length) {
      frame.annotationPrimitives = compileAnnotations(frame.state, snap, warnOnce);
    }
    if (snap.labels?.length) {
      frame.labelPrimitives = compileLabels(snap.labels, { sceneProgress: frame.blockProgress });
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
    index: scene.index,
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
  };
};
