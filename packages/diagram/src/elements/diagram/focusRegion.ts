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

/**
 * Contract for the focus region service.
 * Allows per-instance creation for isolated testing without module-level singleton bleed.
 */
export interface IFocusRegionService {
  /** Returns the current focus region, or null if none is active. */
  getDiagramFocusRegion(): DiagramFocusRegionState | null;
  /**
   * Publishes a group-level focus region for a diagram group.
   * Replaces any previously active focus region.
   */
  publishDiagramFocusGroup(
    diagram: Pick<DiagramState, 'id'>,
    diagramId: string,
    groupId: string,
  ): void;
  /**
   * Publishes a canvas-level focus region for a diagram.
   * Replaces any previously active focus region.
   */
  publishDiagramFocusCanvas(diagram: Pick<DiagramState, 'id'>): void;
  /**
   * Clears the current focus region.
   * If canvasId is provided, only clears if the active region belongs to that canvas.
   */
  clearDiagramFocusRegion(canvasId?: string): void;
}

/** Class-based focus region service, instantiatable per test to avoid singleton bleed. */
export class DiagramFocusRegionService implements IFocusRegionService {
  private current: DiagramFocusRegionState | null = null;

  private dispatch(next: DiagramFocusRegionState | null): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<DiagramFocusRegionState | null>(DIAGRAM_FOCUS_REGION_EVENT, { detail: next }));
  }

  getDiagramFocusRegion(): DiagramFocusRegionState | null {
    return this.current;
  }

  publishDiagramFocusGroup(
    diagram: Pick<DiagramState, 'id'>,
    diagramId: string,
    groupId: string,
  ): void {
    this.current = {
      kind: 'group',
      canvasId: diagram.id,
      diagramId,
      groupId,
      focusedAt: Date.now(),
    };
    this.dispatch(this.current);
  }

  publishDiagramFocusCanvas(diagram: Pick<DiagramState, 'id'>): void {
    this.current = {
      kind: 'canvas',
      canvasId: diagram.id,
      diagramId: null,
      groupId: null,
      focusedAt: Date.now(),
    };
    this.dispatch(this.current);
  }

  clearDiagramFocusRegion(canvasId?: string): void {
    if (canvasId && this.current?.canvasId !== canvasId) return;
    this.current = null;
    this.dispatch(null);
  }
}

/** Default singleton used by DiagramWidget and useDiagramFocusRegion in production. */
export const diagramFocusRegionService: IFocusRegionService = new DiagramFocusRegionService();

// Backwards-compatible module-level function wrappers.
// These preserve the existing public API and require no caller changes.

/** Returns the current focus region, or null if none is active. */
export const getDiagramFocusRegion = (): DiagramFocusRegionState | null =>
  diagramFocusRegionService.getDiagramFocusRegion();

/**
 * Publishes a group-level focus region for a diagram group.
 * Replaces any previously active focus region.
 */
export const publishDiagramFocusGroup = (
  diagram: Pick<DiagramState, 'id'>,
  diagramId: string,
  groupId: string,
): void => diagramFocusRegionService.publishDiagramFocusGroup(diagram, diagramId, groupId);

/**
 * Publishes a canvas-level focus region for a diagram.
 * Replaces any previously active focus region.
 */
export const publishDiagramFocusCanvas = (diagram: Pick<DiagramState, 'id'>): void =>
  diagramFocusRegionService.publishDiagramFocusCanvas(diagram);

/**
 * Clears the current focus region.
 * If canvasId is provided, only clears if the active region belongs to that canvas.
 */
export const clearDiagramFocusRegion = (canvasId?: string): void =>
  diagramFocusRegionService.clearDiagramFocusRegion(canvasId);
