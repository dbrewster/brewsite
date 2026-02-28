import type { ReactElement } from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';
import type { CompileWarning } from './sceneTrackTypes';
import type { HudItemDefinition } from '../hud/types';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushHudItem: (item: HudItemDefinition) => void;
  pushLabel: (label: LabelResolved) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
  pushWarning: (warning: CompileWarning) => void;
};

export type CompileHelpers = {
  compileChildren: (node: ReactElement, api: CompileApi) => void;
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
