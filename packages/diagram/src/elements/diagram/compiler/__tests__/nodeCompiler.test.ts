// Tests for nodeCompiler and groupCompiler.
// Covers: theme-driven node defaults (defaultSize, iconScale, iconDepthFactor), derive factors, labelColor propagation.

import { describe, it, expect } from 'vitest';
import { buildNodeDefaults, buildGroupDefaults, compileNode } from '../nodeCompiler';
import { compileGroup } from '../groupCompiler';
import { darkGlassTheme } from '../../themes/darkGlass';
import type { DiagramNodeDSL, DiagramGroupDSL } from '../../types';
import type { GroupBounds } from '../groupCompiler';
import { deriveColor } from '../../math/colorUtils';

// ─── buildNodeDefaults ────────────────────────────────────────────────────────

describe('buildNodeDefaults — theme-driven defaults', () => {
  it('uses theme.node.defaultSize for size', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.size).toEqual(darkGlassTheme.node.defaultSize);
    expect(nd.size).toEqual([4, 2]);
  });

  it('uses theme.node.defaultSize from a custom theme, not a hardcoded constant', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultSize: [6, 3] as const } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.size).toEqual([6, 3]);
  });

  it('reads theme.node.defaultBoxColor when provided', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultBoxColor: '#223344' } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.boxColor).toBe('#223344');
  });
});

describe('buildNodeDefaults — sideColorDarkenFactor', () => {
  it('reads sideColorDarkenFactor from theme.node', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, sideColorDarkenFactor: -0.25 },
    };
    const nd = buildNodeDefaults(theme);
    expect(nd.sideColorDarkenFactor).toBe(-0.25);
  });

  it('reflects darkGlassTheme.node.sideColorDarkenFactor', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.sideColorDarkenFactor).toBe(darkGlassTheme.node.sideColorDarkenFactor);
  });
});

describe('buildNodeDefaults — borderColorLightenFactor', () => {
  it('reads borderColorLightenFactor from theme.node', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, borderColorLightenFactor: 0.35 },
    };
    const nd = buildNodeDefaults(theme);
    expect(nd.borderColorLightenFactor).toBe(0.35);
  });

  it('reflects darkGlassTheme.node.borderColorLightenFactor', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.borderColorLightenFactor).toBe(darkGlassTheme.node.borderColorLightenFactor);
  });
});

// ─── compileNode — derive factors ─────────────────────────────────────────────

describe('compileNode — sideColor derived from theme factor', () => {
  it('uses theme defaultBoxColor as the compiled box color when dsl does not override it', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, defaultBoxColor: '#223344' },
    };
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1' };
    const node = compileNode(dsl, [0, 0, 0], undefined, theme);
    expect(node.sideColor).toBe('#223344');
  });

  it('uses dsl.boxColor when explicitly set', () => {
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1', boxColor: '#445566' };
    const node = compileNode(dsl, [0, 0, 0], undefined, darkGlassTheme);
    expect(node.sideColor).toBe('#445566');
  });

  it('uses theme sideColorDarkenFactor to derive sideColor when dsl.sideColor not set', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, defaultBoxColor: undefined, sideColorDarkenFactor: 0.0 },
    };
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1' };
    const node = compileNode(dsl, [0, 0, 0], undefined, theme);
    expect(node.sideColor).toBe(deriveColor(node.color, 0));
  });

  it('respects dsl.sideColor when explicitly set, ignoring derive factor', () => {
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1', sideColor: '#112233' };
    const node = compileNode(dsl, [0, 0, 0], undefined, darkGlassTheme);
    expect(node.sideColor).toBe('#112233');
  });

  it('prefers dsl.boxColor over the legacy dsl.sideColor alias when both are set', () => {
    const dsl: DiagramNodeDSL = {
      id: 'n1',
      label: 'Node 1',
      boxColor: '#445566',
      sideColor: '#112233',
    };
    const node = compileNode(dsl, [0, 0, 0], undefined, darkGlassTheme);
    expect(node.sideColor).toBe('#445566');
  });
});

describe('compileNode — borderColor derived from theme factor', () => {
  it('uses theme borderColorLightenFactor to derive borderColor when dsl.borderColor not set', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, borderColorLightenFactor: 0.0 },
    };
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1' };
    const node = compileNode(dsl, [0, 0, 0], undefined, theme);
    // With factor 0.0, borderColor should equal the base color (no adjustment).
    expect(node.borderColor).toBe(node.color);
  });

  it('respects dsl.borderColor when explicitly set, ignoring derive factor', () => {
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1', borderColor: '#aabbcc' };
    const node = compileNode(dsl, [0, 0, 0], undefined, darkGlassTheme);
    expect(node.borderColor).toBe('#aabbcc');
  });
});

// ─── buildGroupDefaults — labelColor ─────────────────────────────────────────

describe('buildGroupDefaults — labelColor', () => {
  it('reads labelColor from theme.group.defaultLabelColor', () => {
    const theme = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultLabelColor: '#ccddee' },
    };
    const gd = buildGroupDefaults(theme);
    expect(gd.labelColor).toBe('#ccddee');
  });

  it('reflects darkGlassTheme.group.defaultLabelColor', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.labelColor).toBe(darkGlassTheme.group.defaultLabelColor);
  });
});

// ─── compileGroup — labelColor propagation ────────────────────────────────────

const makeBounds = (): GroupBounds => ({
  x: 0, y: 0, w: 10, h: 5,
  padding: [1, 1, 1, 1],
  titleGap: 1,
});

describe('compileGroup — labelColor from defaults', () => {
  it('uses theme default labelColor when dsl.labelColor is not set', () => {
    const theme = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultLabelColor: '#ffffff' },
    };
    const dsl: DiagramGroupDSL = { id: 'g1', label: 'Group 1', nodeIds: [] };
    const state = compileGroup(dsl, makeBounds(), theme);
    expect(state.labelColor).toBe('#ffffff');
  });

  it('uses dsl.labelColor when explicitly set, overriding theme default', () => {
    const dsl: DiagramGroupDSL = { id: 'g1', label: 'Group 1', nodeIds: [], labelColor: '#ff0000' };
    const state = compileGroup(dsl, makeBounds(), darkGlassTheme);
    expect(state.labelColor).toBe('#ff0000');
  });

  it('different themes produce different labelColors via defaults', () => {
    const themeA = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultLabelColor: '#aaaaaa' },
    };
    const themeB = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultLabelColor: '#bbbbbb' },
    };
    const dsl: DiagramGroupDSL = { id: 'g1', label: 'Group 1', nodeIds: [] };
    const stateA = compileGroup(dsl, makeBounds(), themeA);
    const stateB = compileGroup(dsl, makeBounds(), themeB);
    expect(stateA.labelColor).toBe('#aaaaaa');
    expect(stateB.labelColor).toBe('#bbbbbb');
  });
});
