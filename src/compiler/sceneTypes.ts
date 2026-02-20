import type { ReactNode } from 'react';
import type { SceneTimeline } from '../timeline';
import type { SceneFrame, SceneFrameDelta } from './sceneTrackTypes';
import type { VariableStoreReader, JsonPrimitive } from '../widget/VariableStore';

export type SceneFrameState = SceneFrame; // alias

export type SceneFrameContext = {
  progress: number;
  sceneProgress: number;
  sceneProgressRaw?: number;
  globalProgress: number;
  sceneStart: number;
  sceneEnd: number;
  assetsReady: boolean;
  timeline: SceneTimeline;
  baseState?: SceneFrame;
  baseStateRaw?: SceneFrame;
  nextState?: SceneFrame;
  variables?: VariableStoreReader;
  viewport?: { width: number; height: number; aspectRatio: number };
  widgetRegistry?: unknown; // Typed as unknown to avoid circular imports
};

export type SceneTransition = {
  id: string;
  start: number | ((context: SceneFrameContext) => number);
  end: number | ((context: SceneFrameContext) => number);
  scope?: 'active' | 'persist';
  apply: (state: SceneFrame, context: SceneFrameContext, t: number) => SceneFrame;
};

export type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>;
  entryLead?: number;
  entryStart?: number;
  getFrame: (context: SceneFrameContext) => ReactNode | SceneFrame;
  transitions?: SceneTransition[];
};

export type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
};
