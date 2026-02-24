import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { AnnotationPositioner } from '../AnnotationPositioner';
import type { AnnotationResolved } from '../../annotations/annotationTypes';
import type { LabelResolved } from '../../labels/types';

const makeCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
};

describe('AnnotationPositioner', () => {
  it('positions fixed annotations using container size and offsets', () => {
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize(100, 200);
    const el = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('a', el);

    const annotations: AnnotationResolved[] = [
      {
        id: 'a',
        label: 'A',
        placement: {
          mode: 'fixed',
          reference: { x: 'left', y: 'top' },
          offset: { xPct: 0.1, yPct: 0.2 },
        },
        style: {},
      },
    ];

    positioner.update(annotations, [], makeCamera(), new Map(), new Map());

    expect((el.style as unknown as Record<string, string>).transform).toBe('translate(10px, 40px)');
  });

  it('positions follow annotations based on projected bone position', () => {
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize(100, 100);
    const el = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('a', el);

    const annotations: AnnotationResolved[] = [
      {
        id: 'a',
        label: 'A',
        placement: {
          mode: 'follow',
          targetPartId: 'head',
          targetOffset: [0, 0, 0],
          screenOffset: { xPct: 0, yPct: 0 },
        },
        style: {},
      },
    ];

    const bones = new Map<string, [number, number, number]>([['head', [0, 0, 0]]]);

    positioner.update(annotations, [], makeCamera(), bones, new Map());

    expect((el.style as unknown as Record<string, string>).transform).toBe('translate(50px, 50px)');
  });

  it('hides disabled annotations and labels', () => {
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize(100, 100);
    const annotationEl = { style: {} as Record<string, string> } as unknown as HTMLElement;
    const labelEl = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('a', annotationEl);
    positioner.registerElement('l', labelEl);

    const annotations: AnnotationResolved[] = [
      {
        id: 'a',
        label: 'A',
        enabled: false,
        placement: {
          mode: 'fixed',
          reference: { x: 'center', y: 'middle' },
          offset: { xPct: 0, yPct: 0 },
        },
        style: {},
      },
    ];
    const labels: LabelResolved[] = [
      {
        id: 'l',
        text: 'L',
        targetPartId: 'head',
        enabled: false,
      },
    ];

    positioner.update(annotations, labels, makeCamera(), new Map([['head', [0, 0, 0]]]), new Map());

    expect((annotationEl.style as unknown as Record<string, string>).display).toBe('none');
    expect((labelEl.style as unknown as Record<string, string>).display).toBe('none');
  });

  it('returns early when container size is zero', () => {
    const positioner = new AnnotationPositioner();
    const el = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('a', el);
    const annotations: AnnotationResolved[] = [
      {
        id: 'a',
        label: 'A',
        placement: {
          mode: 'fixed',
          reference: { x: 'center', y: 'middle' },
          offset: { xPct: 0, yPct: 0 },
        },
        style: {},
      },
    ];
    positioner.update(annotations, [], makeCamera(), new Map(), new Map());
    expect((el.style as unknown as Record<string, string>).transform).toBeUndefined();
  });

  it('skips follow annotations with missing bone positions', () => {
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize(100, 100);
    const el = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('a', el);
    const annotations: AnnotationResolved[] = [
      {
        id: 'a',
        label: 'A',
        placement: {
          mode: 'follow',
          targetPartId: 'missing',
          targetOffset: [0, 0, 0],
        },
        style: {},
      },
    ];
    positioner.update(annotations, [], makeCamera(), new Map(), new Map());
    expect((el.style as unknown as Record<string, string>).transform).toBeUndefined();
  });

  it('positions labels when bone positions are available', () => {
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize(200, 200);
    const labelEl = { style: {} as Record<string, string> } as unknown as HTMLElement;
    positioner.registerElement('l', labelEl);
    const labels: LabelResolved[] = [
      { id: 'l', text: 'Label', targetPartId: 'head', enabled: true },
    ];
    positioner.update([], labels, makeCamera(), new Map([['head', [0, 0, 0]]]), new Map());
    expect((labelEl.style as unknown as Record<string, string>).display).toBe('');
  });
});
