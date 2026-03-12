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
};

export type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
