// @vitest-environment jsdom
// focusRegion.test.ts — unit tests for the class-based DiagramFocusRegionService.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DiagramFocusRegionService,
  DIAGRAM_FOCUS_REGION_EVENT,
} from '../focusRegion';

// Instantiate a fresh service for each test to avoid cross-test state bleed.
let service: DiagramFocusRegionService;
beforeEach(() => {
  service = new DiagramFocusRegionService();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const diagramA = { id: 'diagramA' };
const diagramB = { id: 'diagramB' };

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('DiagramFocusRegionService — initial state', () => {
  it('returns null when no focus region has been published', () => {
    expect(service.getDiagramFocusRegion()).toBeNull();
  });
});

// ─── publishDiagramFocusGroup ─────────────────────────────────────────────────

describe('DiagramFocusRegionService — publishDiagramFocusGroup', () => {
  it('sets the current focus region with kind=group', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    const region = service.getDiagramFocusRegion();
    expect(region).not.toBeNull();
    expect(region?.kind).toBe('group');
    expect(region?.canvasId).toBe('diagramA');
    expect(region?.diagramId).toBe('diagramA');
    expect(region?.groupId).toBe('g1');
  });

  it('replaces a previously published focus region', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g2');
    expect(service.getDiagramFocusRegion()?.groupId).toBe('g2');
  });

  it('sets focusedAt to a recent timestamp', () => {
    const before = Date.now();
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    const after = Date.now();
    const focusedAt = service.getDiagramFocusRegion()?.focusedAt ?? 0;
    expect(focusedAt).toBeGreaterThanOrEqual(before);
    expect(focusedAt).toBeLessThanOrEqual(after);
  });
});

// ─── publishDiagramFocusCanvas ────────────────────────────────────────────────

describe('DiagramFocusRegionService — publishDiagramFocusCanvas', () => {
  it('sets the current focus region with kind=canvas', () => {
    service.publishDiagramFocusCanvas(diagramA);
    const region = service.getDiagramFocusRegion();
    expect(region?.kind).toBe('canvas');
    expect(region?.canvasId).toBe('diagramA');
    expect(region?.diagramId).toBeNull();
    expect(region?.groupId).toBeNull();
  });
});

// ─── clearDiagramFocusRegion ─────────────────────────────────────────────────

describe('DiagramFocusRegionService — clearDiagramFocusRegion', () => {
  it('clears the current region when called with no argument', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    service.clearDiagramFocusRegion();
    expect(service.getDiagramFocusRegion()).toBeNull();
  });

  it('clears the region when canvasId matches the current region', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    service.clearDiagramFocusRegion('diagramA');
    expect(service.getDiagramFocusRegion()).toBeNull();
  });

  it('does not clear when canvasId does not match the current region', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    service.clearDiagramFocusRegion('diagramB');
    expect(service.getDiagramFocusRegion()).not.toBeNull();
  });

  it('is a no-op when there is no current region', () => {
    expect(() => service.clearDiagramFocusRegion()).not.toThrow();
    expect(service.getDiagramFocusRegion()).toBeNull();
  });

  it('does not cross-contaminate between two service instances', () => {
    const serviceB = new DiagramFocusRegionService();
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    serviceB.publishDiagramFocusGroup(diagramB, 'diagramB', 'g2');
    service.clearDiagramFocusRegion('diagramA');
    expect(service.getDiagramFocusRegion()).toBeNull();
    expect(serviceB.getDiagramFocusRegion()).not.toBeNull();
  });
});

// ─── CustomEvent dispatch ─────────────────────────────────────────────────────

describe('DiagramFocusRegionService — CustomEvent dispatch', () => {
  it('dispatches DIAGRAM_FOCUS_REGION_EVENT on window when publishing a group focus', () => {
    const dispatched: CustomEvent[] = [];
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation((e) => {
      dispatched.push(e as CustomEvent);
      return true;
    });
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    expect(spy).toHaveBeenCalledOnce();
    expect(dispatched[0]?.type).toBe(DIAGRAM_FOCUS_REGION_EVENT);
    const detail = (dispatched[0] as CustomEvent).detail;
    expect(detail?.groupId).toBe('g1');
  });

  it('dispatches DIAGRAM_FOCUS_REGION_EVENT with null detail when clearing', () => {
    const dispatched: CustomEvent[] = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((e) => {
      dispatched.push(e as CustomEvent);
      return true;
    });
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    dispatched.length = 0; // reset
    service.clearDiagramFocusRegion();
    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as CustomEvent).detail).toBeNull();
  });

  it('does not dispatch when clearDiagramFocusRegion canvasId does not match', () => {
    service.publishDiagramFocusGroup(diagramA, 'diagramA', 'g1');
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    service.clearDiagramFocusRegion('diagramB');
    expect(spy).not.toHaveBeenCalled();
  });
});
