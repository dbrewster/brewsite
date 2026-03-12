// Tests for nodeCompiler and groupCompiler.
// Covers: derive factors, labelColor propagation.
// Note: build*Defaults tests have moved to defaultsCompiler.test.ts.

import { describe, it, expect } from 'vitest';
import { compileNode } from '../nodeCompiler';
import { compileGroup } from '../groupCompiler';
import { darkGlassTheme } from '../../themes/darkGlass';
import type { DiagramNodeDSL, DiagramGroupDSL } from '../../types';
import type { GroupBounds } from '../groupCompiler';
import { deriveColor } from '../../math/colorUtils';

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
    expect(node.borderColor.toLowerCase()).toBe(node.color.toLowerCase());
  });

  it('respects dsl.borderColor when explicitly set, ignoring derive factor', () => {
    const dsl: DiagramNodeDSL = { id: 'n1', label: 'Node 1', borderColor: '#aabbcc' };
    const node = compileNode(dsl, [0, 0, 0], undefined, darkGlassTheme);
    expect(node.borderColor).toBe('#aabbcc');
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
