import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getHandlerCategory, getNodeHandler, isPrimitiveComponent, registerNode } from '../registry';
import { getNodeHandler as getNodeHandlerFromBarrel } from '../../index';
import type { CompileApi } from '../sceneDslTypes';

const fakeApi: CompileApi = {
  context: {} as CompileApi['context'],
  state: { id: '', scrollProgress: 0, widgets: {} },
  setWidgetState: () => {},
  setSceneMeta: (meta) => {
    if (meta.id) fakeApi.state.id = meta.id;
  },
  pushWarning: () => {},
  composeBounds: (r) => r,
  composeZ: (z) => z,
  composeOpacity: (o) => o,
  pushOverlay: () => {},
};

describe('compiler registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registerNode and getNodeHandler resolve by component reference', () => {
    const Comp = () => null;
    registerNode(Comp, (node, api) => {
      api.setSceneMeta({ id: 'ok' });
    });
    const handler = getNodeHandler(Comp);
    expect(handler).toBeDefined();
    handler?.({ props: {} } as never, fakeApi as never, {} as never);
    expect(fakeApi.state.id).toBe('ok');
  });

  it('registerNode also resolves by displayName', () => {
    const Comp = () => null;
    Comp.displayName = 'Fancy';
    registerNode(Comp, () => {});
    const Other = () => null;
    Other.displayName = 'Fancy';
    const handler = getNodeHandler(Other);
    expect(handler).toBeDefined();
  });

  it('isPrimitiveComponent returns true for registered components', () => {
    const Comp = () => null;
    registerNode(Comp, () => {});
    expect(isPrimitiveComponent(Comp)).toBe(true);
    expect(isPrimitiveComponent(() => null)).toBe(false);
  });

  it('clearRegistry removes handlers', () => {
    const Comp = () => null;
    registerNode(Comp, () => {});
    clearRegistry();
    expect(getNodeHandler(Comp)).toBeUndefined();
  });
});

// ─── Barrel smoke test ────────────────────────────────────────────────────────
describe('root barrel — getNodeHandler is exported', () => {
  it('getNodeHandler is a function exported from the root barrel', () => {
    expect(typeof getNodeHandlerFromBarrel).toBe('function');
  });
});

// ─── NodeHandlerCategory storage and retrieval ────────────────────────────────
describe('getHandlerCategory', () => {
  beforeEach(() => clearRegistry());

  it('returns spatial for a component registered without options', () => {
    const Comp = () => null;
    registerNode(Comp, () => {});
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('returns spatial for an unregistered component', () => {
    const Comp = () => null;
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('returns ambient for a component registered with category: ambient', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'ambient' });
    expect(getHandlerCategory(Comp)).toBe('ambient');
  });

  it('returns spatial for a component registered with category: spatial', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'spatial' });
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });

  it('resolves category by display name when component reference differs', () => {
    // Simulates cross-module identity loss (same displayName, different reference)
    const Comp1 = () => null;
    Comp1.displayName = 'SharedComp';
    registerNode(Comp1, () => {}, { category: 'ambient' });

    const Comp2 = () => null;
    Comp2.displayName = 'SharedComp';
    expect(getHandlerCategory(Comp2)).toBe('ambient');
  });

  it('clearRegistry also clears category entries', () => {
    const Comp = () => null;
    registerNode(Comp, () => {}, { category: 'ambient' });
    clearRegistry();
    expect(getHandlerCategory(Comp)).toBe('spatial');
  });
});
