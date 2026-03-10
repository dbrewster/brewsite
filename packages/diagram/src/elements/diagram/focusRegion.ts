// focusRegion.ts — single focus region event bus for diagram interaction.
import type { DiagramState } from './types';

/** The kind of focus region being published. */
export type DiagramFocusRegionKind = 'group' | 'canvas';

/** Immutable snapshot of the current diagram focus region. */
export interface DiagramFocusRegionState {
  readonly kind: DiagramFocusRegionKind;
  /** Kept as 'canvasId' for backwards compat with useDiagramFocusRegion. */
  readonly canvasId: string;
  readonly diagramId: string | null;
  readonly groupId: string | null;
  readonly focusedAt: number;
}

/** CustomEvent type dispatched on window when the focus region changes. */
export const DIAGRAM_FOCUS_REGION_EVENT = 'brewsite:diagram-focus-region';

let currentFocusRegion: DiagramFocusRegionState | null = null;

/** Returns the current focus region, or null if none is active. */
export const getDiagramFocusRegion = (): DiagramFocusRegionState | null => currentFocusRegion;

const dispatchFocusRegion = (next: DiagramFocusRegionState | null): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DiagramFocusRegionState | null>(DIAGRAM_FOCUS_REGION_EVENT, { detail: next }));
};

/**
 * Publishes a group-level focus region for a diagram group.
 * Replaces any previously active focus region.
 */
export const publishDiagramFocusGroup = (
  diagram: Pick<DiagramState, 'id'>,
  diagramId: string,
  groupId: string,
): void => {
  currentFocusRegion = {
    kind: 'group',
    canvasId: diagram.id,
    diagramId,
    groupId,
    focusedAt: Date.now(),
  };
  dispatchFocusRegion(currentFocusRegion);
};

/**
 * Publishes a canvas-level focus region for a diagram.
 * Replaces any previously active focus region.
 */
export const publishDiagramFocusCanvas = (diagram: Pick<DiagramState, 'id'>): void => {
  currentFocusRegion = {
    kind: 'canvas',
    canvasId: diagram.id,
    diagramId: null,
    groupId: null,
    focusedAt: Date.now(),
  };
  dispatchFocusRegion(currentFocusRegion);
};

/**
 * Clears the current focus region.
 * If canvasId is provided, only clears if the active region belongs to that canvas.
 */
export const clearDiagramFocusRegion = (canvasId?: string): void => {
  if (canvasId && currentFocusRegion?.canvasId !== canvasId) return;
  currentFocusRegion = null;
  dispatchFocusRegion(null);
};
