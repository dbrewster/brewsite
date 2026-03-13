import type { ReactElement, ReactNode } from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';
import type { CompileWarning } from './sceneTrackTypes';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { NVSRect } from '../layout/types';

export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
  pushWarning: (warning: CompileWarning) => void;
  /**
   * Composes a local NVS rect into the absolute NVS coordinate space.
   * Identity when no parent region/view is present.
   * When inside a View, maps local [0..1] into the view's content bounds.
   * Supports arbitrary nesting — each level chains with its parent.
   */
  composeBounds: (localRect: NVSRect) => NVSRect;
  /**
   * Composes a local Z offset into the accumulated parent Z offset.
   * Returns the world-space Z for a child with the given local Z.
   * Identity (returns localZ unchanged) when no parent view has a Z offset.
   */
  composeZ: (localZ: number) => number;
  /**
   * Composes a local opacity with the accumulated parent opacity.
   * Multiplies through nested views — a child at opacity 0.8 inside a
   * view at opacity 0.5 resolves to 0.4. Identity (returns localOpacity
   * unchanged) when no parent view has opacity < 1.
   */
  composeOpacity: (localOpacity: number) => number;
  /**
   * Pushes a ReactNode to the scene's overlay content collection.
   * Used by View/ViewLayout handlers to propagate non-DSL children
   * (e.g. <TextBox>) upward to the scene root's overlay layer.
   * The pushed node is rendered by EngineOverlayHost alongside any
   * overlay content collected directly from Scene children.
   */
  pushOverlay: (node: ReactNode) => void;
};

export type CompileHelpers = {
  compileChildren: (node: ReactElement, api: CompileApi) => void;
  /**
   * Processes all children of node. DSL children (elements with registered
   * NodeHandlers) are compiled into api.state as usual. Non-DSL children
   * (HTML elements and non-registered React components) are collected and
   * returned as a ReactNode array for use as scene overlay content.
   *
   * Called only by sceneRootHandler. Other handlers use compileChildren.
   */
  compileChildrenSeparated(
    node: ReactElement,
    api: CompileApi,
  ): ReactNode[];
  resolveValue: <T>(value: T | ((context: SceneSnapshotContext) => T), context: SceneSnapshotContext) => T;
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, context: SceneSnapshotContext) => T;
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  collectChildren: (node: ReactElement) => unknown[];
  /**
   * Like compileChildrenSeparated, but operates on a pre-collected children array
   * rather than extracting children from a node. Used by the scene root handler
   * to compile the filtered children returned by enforceSceneChildConstraint.
   *
   * DSL children (with registered NodeHandlers) are compiled into api.state.
   * Non-DSL children (HTML elements, non-registered components) are collected
   * and returned as overlay content.
   *
   * If parentNode is provided, its breadcrumb is pushed onto the ancestry stack
   * for the duration of processing — preserving the Scene entry in MISSING_KEY
   * warning ancestry chains.
   */
  compileChildrenFromArray(
    children: unknown[],
    api: CompileApi,
    parentNode?: ReactElement,
  ): ReactNode[];
};

export type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;

/**
 * Classifies a DSL component for Scene-level child constraint enforcement.
 *
 * 'spatial' — element occupies an NVS region in the 3D canvas. Subject to the
 *   Scene view constraint: must be the sole direct child (auto-wrapped) or inside
 *   a <View>. This is the DEFAULT for all registered components.
 *
 * 'ambient' — element configures the scene globally and is not region-bound.
 *   Always allowed as a direct <Scene> child regardless of View presence.
 *   Examples: Camera, Lighting, Background, Environment, Floor, TextBox.
 */
export type NodeHandlerCategory = 'spatial' | 'ambient';

/**
 * Options bag for registerNode. Extensible for future registration metadata.
 */
export type RegisterNodeOptions = {
  /**
   * Category for Scene-level child constraint enforcement.
   * Defaults to 'spatial' if not provided — the safe default for new elements.
   */
  category?: NodeHandlerCategory;
};
