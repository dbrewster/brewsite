import type { DiagramCanvasState } from './canvas/types';

export type DiagramFocusRegionKind = 'group' | 'canvas';

export interface DiagramFocusRegionState {
  readonly kind: DiagramFocusRegionKind;
  readonly canvasId: string;
  readonly diagramId: string | null;
  readonly groupId: string | null;
  readonly focusedAt: number;
}

export const DIAGRAM_FOCUS_REGION_EVENT = 'brewsite:diagram-focus-region';

let currentFocusRegion: DiagramFocusRegionState | null = null;

export const getDiagramFocusRegion = (): DiagramFocusRegionState | null => currentFocusRegion;

const dispatchFocusRegion = (next: DiagramFocusRegionState | null): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DiagramFocusRegionState | null>(DIAGRAM_FOCUS_REGION_EVENT, { detail: next }));
};

export const publishDiagramFocusGroup = (
  canvas: Pick<DiagramCanvasState, 'id'>,
  diagramId: string,
  groupId: string,
): void => {
  currentFocusRegion = {
    kind: 'group',
    canvasId: canvas.id,
    diagramId,
    groupId,
    focusedAt: Date.now(),
  };
  dispatchFocusRegion(currentFocusRegion);
};

export const publishDiagramFocusCanvas = (canvas: Pick<DiagramCanvasState, 'id'>): void => {
  currentFocusRegion = {
    kind: 'canvas',
    canvasId: canvas.id,
    diagramId: null,
    groupId: null,
    focusedAt: Date.now(),
  };
  dispatchFocusRegion(currentFocusRegion);
};

export const clearDiagramFocusRegion = (canvasId?: string): void => {
  if (canvasId && currentFocusRegion?.canvasId !== canvasId) return;
  currentFocusRegion = null;
  dispatchFocusRegion(null);
};
