// Tests for CarouselScrubberWidget — mergeSnapshot, duck-type guard, and render cleanup.

import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import type { CarouselScrubberState, ViewHighlight } from '../types';
import {
  CarouselScrubberWidget,
  isCarouselScrubberStateLike,
} from '../CarouselScrubberWidget';
import {
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  DEFAULT_CAROUSEL_SCRUBBER_STYLE,
} from '../compile';
import {
  getOrCreateCache,
  applyCarouselScrubber,
} from '../render';

// -- Helper: state with highlights -------------------------------------------

function makeState(overrides?: Partial<CarouselScrubberState>): CarouselScrubberState {
  return { ...DEFAULT_CAROUSEL_SCRUBBER_STATE, ...overrides };
}

function makeHighlight(viewId: string): ViewHighlight {
  return {
    viewId,
    bounds: { x: 0, y: 0, w: 0.3, h: 0.5 },
    mode: 'holographic',
    color: '#ff0000',
    intensity: 0.8,
    beamHeight: 5,
    smoke: true,
    blendMode: 'additive',
  };
}

// -- mergeSnapshot -----------------------------------------------------------

describe('CarouselScrubberWidget.mergeSnapshot', () => {
  const widget = new CarouselScrubberWidget('test-tray');

  it('returns undefined when both prev and next are undefined', () => {
    const result = widget.mergeSnapshot(undefined, undefined);
    expect(result).toBeUndefined();
  });

  it('returns next when prev is undefined', () => {
    const next = makeState({ layoutId: 'layout-1', activeIndex: 2 });
    const result = widget.mergeSnapshot(undefined, next);
    expect(result).toBe(next);
  });

  it('merges next into prev when both are defined', () => {
    const prev = makeState({ layoutId: 'layout-1', activeIndex: 0 });
    const next = makeState({ layoutId: 'layout-1', activeIndex: 3 });
    const result = widget.mergeSnapshot(prev, next);
    expect(result).toBeDefined();
    expect(result!.activeIndex).toBe(3);
  });

  it('sets showBase false when next is undefined and prev exists', () => {
    const prev = makeState({ layoutId: 'layout-1', showBase: true });
    const result = widget.mergeSnapshot(prev, undefined);
    expect(result).toBeDefined();
    expect(result!.showBase).toBe(false);
  });

  it('clears viewHighlights when next is undefined and prev has highlights', () => {
    const highlights = [makeHighlight('view-1'), makeHighlight('view-2')];
    const prev = makeState({
      layoutId: 'layout-1',
      showBase: true,
      viewHighlights: highlights,
    });
    const result = widget.mergeSnapshot(prev, undefined);
    expect(result).toBeDefined();
    expect(result!.viewHighlights).toEqual([]);
    expect(result!.showBase).toBe(false);
  });

  it('preserves other state fields when clearing highlights on exit', () => {
    const prev = makeState({
      layoutId: 'layout-1',
      activeIndex: 2,
      childCount: 5,
      loop: true,
      viewHighlights: [makeHighlight('view-1')],
    });
    const result = widget.mergeSnapshot(prev, undefined);
    expect(result).toBeDefined();
    expect(result!.layoutId).toBe('layout-1');
    expect(result!.activeIndex).toBe(2);
    expect(result!.childCount).toBe(5);
    expect(result!.loop).toBe(true);
    expect(result!.viewHighlights).toEqual([]);
  });

  it('does not affect viewHighlights when next is defined', () => {
    const highlights = [makeHighlight('view-1')];
    const prev = makeState({ viewHighlights: [] });
    const next = makeState({ viewHighlights: highlights });
    const result = widget.mergeSnapshot(prev, next);
    expect(result!.viewHighlights).toEqual(highlights);
  });
});

// -- isCarouselScrubberStateLike ---------------------------------------------

describe('isCarouselScrubberStateLike', () => {
  it('returns true for a valid CarouselScrubberState', () => {
    expect(isCarouselScrubberStateLike(DEFAULT_CAROUSEL_SCRUBBER_STATE)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isCarouselScrubberStateLike(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCarouselScrubberStateLike(undefined)).toBe(false);
  });

  it('returns false for a plain object missing required fields', () => {
    expect(isCarouselScrubberStateLike({ layoutId: 'x' })).toBe(false);
  });
});

// -- applyCarouselScrubber cleanup on empty state -----------------------------

describe('applyCarouselScrubber — highlight cleanup on empty state', () => {
  it('hides root and clears highlightMeshes when childCount is 0', () => {
    const scene = new THREE.Scene();
    const cache = getOrCreateCache(scene, 'cleanup-test');

    // Simulate a pre-existing highlight mesh entry in the cache.
    // HighlightMeshSet is not exported, so we use the structural shape directly.
    const hlGroup = new THREE.Group();
    scene.add(hlGroup);
    (cache.highlightMeshes as Map<string, unknown>).set('view-1', {
      group: hlGroup,
      glowPlane: null,
      beamMesh: null,
      backdropMesh: null,
      dustMesh: null,
      dustParticles: null,
      smokeMesh: null,
      smokeParticles: null,
      currentOpacity: 0.5,
      mode: 'glow',
      lastTime: 0,
      currentX: null,
      currentZ: null,
    });

    expect(cache.highlightMeshes.size).toBe(1);
    cache.root.visible = true;

    const state = makeState({ childCount: 0, layoutId: 'some-layout' });
    applyCarouselScrubber(state, cache, scene);

    expect(cache.root.visible).toBe(false);
    expect(cache.highlightMeshes.size).toBe(0);
  });

  it('hides root and clears highlightMeshes when layoutId is empty string', () => {
    const scene = new THREE.Scene();
    const cache = getOrCreateCache(scene, 'cleanup-test-2');

    const hlGroup = new THREE.Group();
    scene.add(hlGroup);
    (cache.highlightMeshes as Map<string, unknown>).set('view-2', {
      group: hlGroup,
      glowPlane: null,
      beamMesh: null,
      backdropMesh: null,
      dustMesh: null,
      dustParticles: null,
      smokeMesh: null,
      smokeParticles: null,
      currentOpacity: 0.8,
      mode: 'holographic',
      lastTime: 0,
      currentX: null,
      currentZ: null,
    });

    expect(cache.highlightMeshes.size).toBe(1);
    cache.root.visible = true;

    const state = makeState({ childCount: 3, layoutId: '' });
    applyCarouselScrubber(state, cache, scene);

    expect(cache.root.visible).toBe(false);
    expect(cache.highlightMeshes.size).toBe(0);
  });

  it('removes highlight group from scene when cleaning up', () => {
    const scene = new THREE.Scene();
    const cache = getOrCreateCache(scene, 'cleanup-test-3');

    const hlGroup = new THREE.Group();
    hlGroup.name = 'test-highlight-group';
    scene.add(hlGroup);
    (cache.highlightMeshes as Map<string, unknown>).set('view-3', {
      group: hlGroup,
      glowPlane: null,
      beamMesh: null,
      backdropMesh: null,
      dustMesh: null,
      dustParticles: null,
      smokeMesh: null,
      smokeParticles: null,
      currentOpacity: 0.5,
      mode: 'glow',
      lastTime: 0,
      currentX: null,
      currentZ: null,
    });

    // The highlight group should be in the scene initially.
    expect(scene.getObjectByName('test-highlight-group')).toBeDefined();

    const state = makeState({ childCount: 0, layoutId: '' });
    applyCarouselScrubber(state, cache, scene);

    // After cleanup, the highlight group should be removed from the scene.
    expect(scene.getObjectByName('test-highlight-group')).toBeUndefined();
  });
});
