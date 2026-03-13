import { describe, it, expect, vi, afterEach } from 'vitest';
import { acquireCSS3DContext, releaseCSS3DContext } from '../css3dSetup';

// CSS3DRenderer imports real DOM manipulation — mock it for unit tests.
vi.mock('three/examples/jsm/renderers/CSS3DRenderer.js', () => ({
  CSS3DRenderer: vi.fn(() => ({
    domElement: document.createElement('div'),
    setSize: vi.fn(),
    render: vi.fn(),
  })),
  CSS3DObject: vi.fn(() => ({})),
}));

describe('css3dSetup', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('acquireCSS3DContext creates a renderer and appends its div to the parent', () => {
    const parent = document.createElement('div');
    const ctx = acquireCSS3DContext(parent);
    expect(ctx).toBeDefined();
    expect(parent.children.length).toBe(1);
  });

  it('second acquire on same parent returns the same context', () => {
    const parent = document.createElement('div');
    const ctx1 = acquireCSS3DContext(parent);
    const ctx2 = acquireCSS3DContext(parent);
    expect(ctx1).toBe(ctx2);
    expect(parent.children.length).toBe(1);
  });

  it('releaseCSS3DContext does not remove renderer until ref count reaches 0', () => {
    const parent = document.createElement('div');
    acquireCSS3DContext(parent);
    acquireCSS3DContext(parent);
    releaseCSS3DContext(parent);
    expect(parent.children.length).toBe(1); // still there
    releaseCSS3DContext(parent);
    expect(parent.children.length).toBe(0); // now removed
  });
});
