import type { ReactElement, ReactNode } from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';
import type { CompileWarning } from './sceneTrackTypes';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushLabel: (label: LabelResolved) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
  pushWarning: (warning: CompileWarning) => void;
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
