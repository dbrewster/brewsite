// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { LabelPositioner } from '../LabelPositioner';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import type { NVSRect } from '@brewsite/core';
import type { LabelResolved } from '../../labels/types';

const makeCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
};

const makeLabel = (id: string, overrides?: Partial<LabelResolved>): LabelResolved => ({
  id,
  text: 'Test',
  targetPartId: 'bone_head',
  ...overrides,
});

describe('LabelPositioner', () => {
  it('does nothing when container size is zero', () => {
    const positioner = new LabelPositioner();
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const label = makeLabel('l1');
    positioner.update(
      [label],
      makeCamera(),
      new Map([['bone_head', [0, 1, 0] as [number, number, number]]]),
    );
    // transform should not be set since containerWidth/Height are 0
    expect(el.style.transform).toBe('');
  });

  it('sets container size and applies transform after update', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const camera = makeCamera();
    const bones = new Map<string, [number, number, number]>([['bone_head', [0, 0, 0]]]);
    positioner.update([makeLabel('l1')], camera, bones);
    expect(el.style.transform).toContain('translate');
  });

  it('hides element when enabled is false', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update(
      [makeLabel('l1', { enabled: false })],
      makeCamera(),
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );
    expect(el.style.display).toBe('none');
  });

  it('warns once for missing bone target', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // no bones
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // second call
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('unregisters element on null', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.registerElement('l1', null);
    // Should not throw with no registered element
    positioner.update(
      [makeLabel('l1')],
      makeCamera(),
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );
  });
});

// ---------------------------------------------------------------------------
// NVS sub-region projection tests
// ---------------------------------------------------------------------------

/**
 * Returns an OrthographicCamera that maps world coordinates linearly to NDC.
 * left=-1, right=1, top=1, bottom=-1 → world (x,y,0) maps directly to NDC (x,y).
 * Camera is positioned at (0,0,5), looking at origin.
 */
const makeOrthoCamera = (): OrthographicCamera => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
};

/**
 * Reads the transform value off a DOM element after a LabelPositioner.update() call.
 * Returns {x, y} pixel offsets parsed from the CSS translate() string.
 * The widget writes: `translate(${labelScreen.x - anchorX}px, ${labelScreen.y - anchorY}px)`
 * where anchorX/Y are based on dx/dy direction. For a bone at origin with zero offset,
 * target == label so dx=0, dy=0, anchorX=width, anchorY=height. The element has
 * no layout so offsetWidth/offsetHeight are both 0, meaning anchorX=anchorY=0.
 * Therefore the transform is exactly `translate(labelScreen.x px, labelScreen.y px)`.
 */
const parseTranslate = (transform: string): { x: number; y: number } => {
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
  if (!match) throw new Error(`Could not parse transform: ${transform}`);
  return { x: parseFloat(match[1]!), y: parseFloat(match[2]!) };
};

describe('LabelPositioner NVS sub-region projection', () => {
  it('projects label to center of full container when no nvsBounds arg (fullscreen default)', () => {
    // Camera at (0,0,5) projects world (0,0,0) to NDC (0,0).
    // With fullscreen bounds: pixelX = (0*0.5+0.5)*1920 = 960, pixelY = (-0*0.5+0.5)*1080 = 540.
    const positioner = new LabelPositioner();
    positioner.setContainerSize(1920, 1080);

    const el = document.createElement('div');
    positioner.registerElement('l1', el);

    const camera = makeOrthoCamera();
    positioner.update(
      [makeLabel('l1')],
      camera,
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );

    const { x, y } = parseTranslate(el.style.transform);
    expect(x).toBeCloseTo(960, 0);
    expect(y).toBeCloseTo(540, 0);
  });

  it('projects label to sub-region center when nvsBounds is right half {x:0.5, y:0, w:0.5, h:1}', () => {
    // Camera projects world (0,0,0) to NDC (0,0).
    // Sub-region: regionLeft=0.5*1920=960, regionWidth=0.5*1920=960, regionHeight=1*1080=1080.
    // pixelX = 960 + (0*0.5+0.5)*960 = 960 + 480 = 1440.
    // pixelY = 0   + (-0*0.5+0.5)*1080 = 540.
    const nvsBounds: NVSRect = { x: 0.5, y: 0, w: 0.5, h: 1 };
    const positioner = new LabelPositioner();
    positioner.setContainerSize(1920, 1080, nvsBounds);

    const el = document.createElement('div');
    positioner.registerElement('l1', el);

    const camera = makeOrthoCamera();
    positioner.update(
      [makeLabel('l1')],
      camera,
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );

    const { x, y } = parseTranslate(el.style.transform);
    expect(x).toBeCloseTo(1440, 0);
    expect(y).toBeCloseTo(540, 0);
  });

  it('projects NDC top-left to pixel (0,0) within sub-region {x:0, y:0, w:0.5, h:0.5}', () => {
    // An orthographic camera with left=-1,right=1,top=1,bottom=-1 maps world (-1,1,0) to NDC (-1,1).
    // NDC (-1,1) is screen top-left.
    // With sub-region {x:0,y:0,w:0.5,h:0.5} on a 400x400 container:
    //   regionLeft=0, regionTop=0, regionWidth=200, regionHeight=200
    //   pixelX = 0 + (-1*0.5+0.5)*200 = 0 + 0 = 0
    //   pixelY = 0 + (-1*0.5+0.5)*200 = 0 + 0 = 0
    const nvsBounds: NVSRect = { x: 0, y: 0, w: 0.5, h: 0.5 };
    const positioner = new LabelPositioner();
    positioner.setContainerSize(400, 400, nvsBounds);

    const el = document.createElement('div');
    positioner.registerElement('l1', el);

    const camera = makeOrthoCamera();
    // World point (-1, 1, 0) projects to NDC (-1, 1) with this ortho camera
    positioner.update(
      [makeLabel('l1')],
      camera,
      new Map([['bone_head', [-1, 1, 0] as [number, number, number]]]),
    );

    const { x, y } = parseTranslate(el.style.transform);
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(0, 0);
  });

  it('falls back to full container projection when nvsBounds is explicitly fullscreen', () => {
    // Explicit fullscreen nvsBounds should produce same result as no nvsBounds.
    const fullscreen: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    const positioner = new LabelPositioner();
    positioner.setContainerSize(1920, 1080, fullscreen);

    const el = document.createElement('div');
    positioner.registerElement('l1', el);

    const camera = makeOrthoCamera();
    positioner.update(
      [makeLabel('l1')],
      camera,
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );

    const { x, y } = parseTranslate(el.style.transform);
    expect(x).toBeCloseTo(960, 0);
    expect(y).toBeCloseTo(540, 0);
  });
});
