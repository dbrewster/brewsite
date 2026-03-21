// Tests for flow layout cascade in layoutResolver.ts and resolveFlowLayout edge cases.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RESOLVED_FLOW,
  DEFAULT_RESOLVED_GRID,
  DEFAULT_RESOLVED_HIERARCHICAL,
  DEFAULT_RESOLVED_MANUAL,
  applyLayoutDefaultsWithTheme,
  mergeResolvedLayouts,
  resolveEffectiveLayout,
  resolveThemeLayoutDefaults,
} from '../layoutResolver';
import type { ResolvedFlowLayout } from '../layoutResolver';
import { resolveLayout, resolveFlowLayout } from '../layoutAlgorithms';
import type { DiagramNodeDSL } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const flow = (overrides: Partial<ResolvedFlowLayout> = {}): ResolvedFlowLayout => ({
  ...DEFAULT_RESOLVED_FLOW,
  ...overrides,
});

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

/** Build a full ResolvedLayoutDefaults including the flow entry. */
const makeFlowDefaults = () => ({
  root: DEFAULT_RESOLVED_GRID,
  grid: DEFAULT_RESOLVED_GRID,
  hierarchical: DEFAULT_RESOLVED_HIERARCHICAL,
  manual: DEFAULT_RESOLVED_MANUAL,
  flow: DEFAULT_RESOLVED_FLOW,
});

// ─── DEFAULT_RESOLVED_FLOW ────────────────────────────────────────────────────

describe('DEFAULT_RESOLVED_FLOW', () => {
  it('has kind: flow', () => {
    expect(DEFAULT_RESOLVED_FLOW.kind).toBe('flow');
  });

  it('has default direction: top-down', () => {
    expect(DEFAULT_RESOLVED_FLOW.direction).toBe('top-down');
  });

  it('has default gap: 0.06', () => {
    expect(DEFAULT_RESOLVED_FLOW.gap).toBe(0.06);
  });

  it('has default groupPadding [0.035, 0.035, 0.035, 0.035]', () => {
    expect(DEFAULT_RESOLVED_FLOW.groupPadding).toEqual([0.035, 0.035, 0.035, 0.035]);
  });

  it('has default titleGap: 0.025', () => {
    expect(DEFAULT_RESOLVED_FLOW.titleGap).toBe(0.025);
  });

  it('does not have spacing, margin, alignment, or disconnected fields', () => {
    expect('spacing' in DEFAULT_RESOLVED_FLOW).toBe(false);
    expect('margin' in DEFAULT_RESOLVED_FLOW).toBe(false);
    expect('alignment' in DEFAULT_RESOLVED_FLOW).toBe(false);
    expect('disconnected' in DEFAULT_RESOLVED_FLOW).toBe(false);
  });
});

// ─── applyLayoutDefaultsWithTheme — flow branch ───────────────────────────────

describe('applyLayoutDefaultsWithTheme — flow branch', () => {
  it('kind=flow: returns a result with kind=flow', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme({ kind: 'flow' }, defaults);
    expect(result.kind).toBe('flow');
  });

  it('kind=flow: inherits flow defaults when no props specified', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme({ kind: 'flow' }, defaults) as ResolvedFlowLayout;
    expect(result.direction).toBe(DEFAULT_RESOLVED_FLOW.direction);
    expect(result.gap).toBe(DEFAULT_RESOLVED_FLOW.gap);
    expect(result.groupPadding).toEqual(DEFAULT_RESOLVED_FLOW.groupPadding);
    expect(result.titleGap).toBe(DEFAULT_RESOLVED_FLOW.titleGap);
  });

  it('kind=flow: overrides direction when specified', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme(
      { kind: 'flow', direction: 'left-right' },
      defaults,
    ) as ResolvedFlowLayout;
    expect(result.direction).toBe('left-right');
  });

  it('kind=flow: overrides gap when specified', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme(
      { kind: 'flow', gap: '500%' },
      defaults,
    ) as ResolvedFlowLayout;
    expect(result.gap).toBe(5);
  });

  it('kind=flow: normalizes groupPadding shorthand (number) to 4-tuple', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme(
      { kind: 'flow', groupPadding: '200%' },
      defaults,
    ) as ResolvedFlowLayout;
    expect(result.groupPadding).toEqual([2, 2, 2, 2]);
  });

  it('kind=flow: does NOT inherit hierarchical fields (no spacing, margin, alignment, disconnected)', () => {
    const defaults = makeFlowDefaults();
    const result = applyLayoutDefaultsWithTheme({ kind: 'flow' }, defaults);
    expect('spacing' in result).toBe(false);
    expect('margin' in result).toBe(false);
    expect('alignment' in result).toBe(false);
    expect('disconnected' in result).toBe(false);
  });
});

// ─── mergeResolvedLayouts — flow branch ──────────────────────────────────────

describe('mergeResolvedLayouts — flow branch', () => {
  it('child gap wins over parent gap', () => {
    const parent = flow({ gap: 3, direction: 'top-down' });
    const result = mergeResolvedLayouts(parent, { kind: 'flow', gap: '700%' } as unknown as ResolvedFlowLayout) as ResolvedFlowLayout;
    expect(result.gap).toBe(7);
  });

  it('parent direction preserved when child omits it', () => {
    const parent = flow({ direction: 'left-right', gap: 2 });
    const result = mergeResolvedLayouts(parent, { kind: 'flow', gap: '400%' } as unknown as ResolvedFlowLayout) as ResolvedFlowLayout;
    expect(result.direction).toBe('left-right');
  });

  it('child direction wins when specified', () => {
    const parent = flow({ direction: 'top-down' });
    const result = mergeResolvedLayouts(
      parent,
      { kind: 'flow', direction: 'left-right' } as unknown as ResolvedFlowLayout,
    ) as ResolvedFlowLayout;
    expect(result.direction).toBe('left-right');
  });

  it('child groupPadding normalized and applied', () => {
    const parent = flow({ groupPadding: [1.5, 1.5, 1.5, 1.5] });
    const result = mergeResolvedLayouts(
      parent,
      { kind: 'flow', groupPadding: '300%' } as unknown as ResolvedFlowLayout,
    ) as ResolvedFlowLayout;
    expect(result.groupPadding).toEqual([3, 3, 3, 3]);
  });

  it('child titleGap wins when specified', () => {
    const parent = flow({ titleGap: 1 });
    const result = mergeResolvedLayouts(
      parent,
      { kind: 'flow', titleGap: '200%' } as unknown as ResolvedFlowLayout,
    ) as ResolvedFlowLayout;
    expect(result.titleGap).toBe(2);
  });

  it('merged result has kind=flow and no grid or hierarchical fields', () => {
    const parent = flow({ gap: 2 });
    const result = mergeResolvedLayouts(parent, { kind: 'flow' } as ResolvedFlowLayout);
    expect(result.kind).toBe('flow');
    expect('spacing' in result).toBe(false);
    expect('columns' in result).toBe(false);
    expect('alignment' in result).toBe(false);
  });

  it('unspecified child props fall through to parent values', () => {
    const parent = flow({ gap: 8, direction: 'left-right', titleGap: 3 });
    const result = mergeResolvedLayouts(parent, { kind: 'flow' } as ResolvedFlowLayout) as ResolvedFlowLayout;
    expect(result.gap).toBe(8);
    expect(result.direction).toBe('left-right');
    expect(result.titleGap).toBe(3);
  });
});

// ─── resolveEffectiveLayout — flow interactions ───────────────────────────────

describe('resolveEffectiveLayout — flow interactions', () => {
  it('flow parent + absent child: inherits flow parent as-is', () => {
    const parent = flow({ gap: 5, direction: 'left-right' });
    const result = resolveEffectiveLayout(undefined, parent);
    expect(result).toEqual(parent);
  });

  it('grid parent + flow child: flow defaults applied, no grid fields inherited', () => {
    const result = resolveEffectiveLayout({ kind: 'flow' }, DEFAULT_RESOLVED_GRID) as ResolvedFlowLayout;
    expect(result.kind).toBe('flow');
    expect('columns' in result).toBe(false);
    expect('spacing' in result).toBe(false);
    expect(result.gap).toBe(DEFAULT_RESOLVED_FLOW.gap);
  });

  it('flow parent + flow child: merges; child gap wins, parent direction preserved', () => {
    const parent = flow({ gap: 3, direction: 'left-right' });
    const result = resolveEffectiveLayout(
      { kind: 'flow', gap: '600%' } as unknown as ResolvedFlowLayout,
      parent,
    ) as ResolvedFlowLayout;
    expect(result.gap).toBe(6);
    expect(result.direction).toBe('left-right');
  });

  it('absent own + absent parent: falls back to default grid (not flow)', () => {
    const result = resolveEffectiveLayout(undefined, undefined);
    expect(result.kind).toBe('grid');
  });
});

// ─── resolveThemeLayoutDefaults — flow branch ────────────────────────────────

describe('resolveThemeLayoutDefaults — flow branch', () => {
  it('defaultKind: flow → root is ResolvedFlowLayout', () => {
    const defaults = resolveThemeLayoutDefaults({ defaultKind: 'flow' } as Parameters<typeof resolveThemeLayoutDefaults>[0]);
    expect(defaults.root.kind).toBe('flow');
  });

  it('flow: { gap: 3 } → flow defaults have gap=3', () => {
    const defaults = resolveThemeLayoutDefaults({ flow: { gap: '300%' } } as Parameters<typeof resolveThemeLayoutDefaults>[0]);
    const flowDef = (defaults as unknown as { flow: ResolvedFlowLayout }).flow;
    expect(flowDef.gap).toBe(3);
  });

  it('flow: { direction: left-right } → flow defaults have that direction', () => {
    const defaults = resolveThemeLayoutDefaults({ flow: { direction: 'left-right' } } as unknown as Parameters<typeof resolveThemeLayoutDefaults>[0]);
    const flowDef = (defaults as unknown as { flow: ResolvedFlowLayout }).flow;
    expect(flowDef.direction).toBe('left-right');
  });

  it('flow: { groupPadding: 2 } → normalizes groupPadding to [2, 2, 2, 2]', () => {
    const defaults = resolveThemeLayoutDefaults({ flow: { groupPadding: '200%' } } as Parameters<typeof resolveThemeLayoutDefaults>[0]);
    const flowDef = (defaults as unknown as { flow: ResolvedFlowLayout }).flow;
    expect(flowDef.groupPadding).toEqual([2, 2, 2, 2]);
  });

  it('defaults object includes flow entry', () => {
    const defaults = resolveThemeLayoutDefaults(undefined);
    expect('flow' in defaults).toBe(true);
    const flowDef = (defaults as unknown as { flow: ResolvedFlowLayout }).flow;
    expect(flowDef.kind).toBe('flow');
  });

  it('non-flow defaultKind: root is NOT flow layout', () => {
    const defaults = resolveThemeLayoutDefaults({ defaultKind: 'hierarchical' });
    expect(defaults.root.kind).toBe('hierarchical');
  });
});

// ─── dispatch guard: resolveLayout with kind=flow ────────────────────────────

describe('dispatch guard — resolveLayout kind=flow', () => {
  it('dispatches to flow layout behavior (not grid fallback)', () => {
    const nodes = [makeNode('a', { size: ['400%', '200%'] }), makeNode('b', { size: ['400%', '200%'] })];
    // Flow top-down with default gap=0.06: a at y=0, b at y=-(h/2+gap+h/2)=-(1+0.06+1)=-2.06
    // Grid would assign both to y=0 but different x. If flow is dispatched, a is at [0,0,0].
    const result = resolveLayout(nodes, [], DEFAULT_RESOLVED_FLOW, undefined, ['a', 'b']);
    expect(result.get('a')).toEqual([0, 0, 0]);
    expect(result.get('b')).toEqual([0, -2.06, 0]);
  });
});

// ─── resolveFlowLayout — edge cases ──────────────────────────────────────────

describe('resolveFlowLayout — edge cases', () => {
  it('zero items: returns empty positions map', () => {
    const result = resolveFlowLayout([], flow({ direction: 'top-down', gap: 2 }), []);
    expect(result.size).toBe(0);
  });

  it('phantom ids in childrenOrder are silently dropped', () => {
    const nodes = [makeNode('a', { size: ['400%', '200%'] }), makeNode('b', { size: ['400%', '200%'] })];
    const result = resolveFlowLayout(
      nodes,
      flow({ direction: 'top-down', gap: 1 }),
      ['a', 'phantom', 'b'],
    );
    expect(result.has('phantom')).toBe(false);
    expect(result.size).toBe(2);
    // a placed before b → a has higher (more positive) Y
    expect(result.get('a')![1]).toBeGreaterThan(result.get('b')![1]);
  });
});
