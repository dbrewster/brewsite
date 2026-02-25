import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, getNodeHandler, isPrimitiveComponent, registerNode } from '../registry';
import type { CompileApi } from '../sceneDslTypes';

const fakeApi: CompileApi = {
  context: {} as CompileApi['context'],
  state: { id: '', scrollProgress: 0, widgets: {} },
  pushHudItem: () => {},
  pushLabel: () => {},
  setWidgetState: () => {},
  setSceneMeta: (meta) => {
    if (meta.id) fakeApi.state.id = meta.id;
  },
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
