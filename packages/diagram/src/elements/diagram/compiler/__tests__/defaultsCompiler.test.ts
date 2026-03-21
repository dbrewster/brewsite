// Tests for defaultsCompiler — buildNodeDefaults, buildEdgeDefaults, buildGroupDefaults.

import { describe, it, expect } from 'vitest';
import { buildNodeDefaults, buildEdgeDefaults, buildGroupDefaults } from '../defaultsCompiler';
import { darkGlassTheme } from '../../themes/darkGlass';
import { resolveToNVS } from '@brewsite/core';

// ─── buildNodeDefaults ────────────────────────────────────────────────────────

describe('buildNodeDefaults — theme-driven defaults', () => {
  it('uses theme.node.defaultSize for size', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.size).toEqual([0.15, 0.08]);
  });

  it('uses theme.node.defaultSize from a custom theme, not a hardcoded constant', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultSize: ['600%', '300%'] as const } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.size).toEqual([6, 3]);
  });

  it('reads theme.node.defaultBoxColor when provided', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultBoxColor: '#223344' } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.boxColor).toBe('#223344');
  });

  it('sets opacity to 1 by default', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.opacity).toBe(1);
  });

  it('sets clickable to false by default', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.clickable).toBe(false);
  });

  it('sets enabled to true by default', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.enabled).toBe(true);
  });

  it('reads iconScale from theme.node.defaultIconScale', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultIconScale: 0.75 } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.iconScale).toBe(0.75);
  });

  it('reads iconStyle from theme.node.defaultIconStyle', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.iconStyle).toBe(darkGlassTheme.node.defaultIconStyle);
  });

  it('reads iconDepth from theme.node.defaultIconDepth', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultIconDepth: '15%' } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.iconDepth).toBe(0.15);
  });

  it('reads labelColor from theme.node.defaultLabelColor', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultLabelColor: '#aabbcc' } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.labelColor).toBe('#aabbcc');
  });

  it('reads sublabelColor from theme.node.defaultSublabelColor', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.sublabelColor).toBe(darkGlassTheme.node.defaultSublabelColor);
  });
});

describe('buildNodeDefaults — boxColor', () => {
  it('reads boxColor from theme.node.defaultBoxColor', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, defaultBoxColor: '#223344' },
    };
    const nd = buildNodeDefaults(theme);
    expect(nd.boxColor).toBe('#223344');
  });

  it('reflects darkGlassTheme.node.defaultBoxColor', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.boxColor).toBe(darkGlassTheme.node.defaultBoxColor);
  });
});

describe('buildNodeDefaults — borderColor', () => {
  it('reads borderColor from theme.node.defaultBorderColor', () => {
    const theme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, defaultBorderColor: '#556677' },
    };
    const nd = buildNodeDefaults(theme);
    expect(nd.borderColor).toBe('#556677');
  });

  it('reflects darkGlassTheme.node.defaultBorderColor', () => {
    const nd = buildNodeDefaults(darkGlassTheme);
    expect(nd.borderColor).toBe(darkGlassTheme.node.defaultBorderColor);
  });
});

// ─── buildEdgeDefaults ────────────────────────────────────────────────────────

describe('buildEdgeDefaults — theme-driven defaults', () => {
  it('sets style to solid', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.style).toBe('solid');
  });

  it('sets arrowStart to none', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.arrowStart).toBe('none');
  });

  it('sets arrowEnd to none', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.arrowEnd).toBe('none');
  });

  it('reads color from theme.edge.defaultColor', () => {
    const customTheme = { ...darkGlassTheme, edge: { ...darkGlassTheme.edge, defaultColor: '#ff0000' } };
    const ed = buildEdgeDefaults(customTheme);
    expect(ed.color).toBe('#ff0000');
  });

  it('reads thickness from theme.edge.defaultThickness', () => {
    const customTheme = { ...darkGlassTheme, edge: { ...darkGlassTheme.edge, defaultThickness: '8%' } };
    const ed = buildEdgeDefaults(customTheme);
    expect(ed.thickness).toBe(0.08);
  });

  it('sets opacity to 1 by default', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.opacity).toBe(1);
  });

  it('reads routing from theme.edge.routing', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.routing).toBe(darkGlassTheme.edge.routing);
  });

  it('sets allowUnderpass to true by default', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.allowUnderpass).toBe(true);
  });

  it('sets flow to none by default', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.flow).toBe('none');
  });

  it('reads flowTurnRadius from theme.edge', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.flowTurnRadius).toBe(resolveToNVS(darkGlassTheme.edge.flowTurnRadius));
  });

  it('reads flowBundleStrength from theme.edge', () => {
    const ed = buildEdgeDefaults(darkGlassTheme);
    expect(ed.flowBundleStrength).toBe(darkGlassTheme.edge.flowBundleStrength);
  });
});

// ─── buildGroupDefaults ────────────────────────────────────────────────────────

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

describe('buildGroupDefaults — theme-driven defaults', () => {
  it('sets variant to boundary', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.variant).toBe('boundary');
  });

  it('sets orientation to vertical', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.orientation).toBe('vertical');
  });

  it('sets borderStyle to solid', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.borderStyle).toBe('solid');
  });

  it('reads color from theme.group.defaultColor', () => {
    const customTheme = { ...darkGlassTheme, group: { ...darkGlassTheme.group, defaultColor: '#112233' } };
    const gd = buildGroupDefaults(customTheme);
    expect(gd.color).toBe('#112233');
  });

  it('reads borderColor from theme.group.defaultBorderColor', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.borderColor).toBe(darkGlassTheme.group.defaultBorderColor);
  });

  it('reads fillOpacity from theme.group.defaultFillOpacity', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.fillOpacity).toBe(darkGlassTheme.group.defaultFillOpacity);
  });

  it('reads borderOpacity from theme.group.defaultBorderOpacity', () => {
    const gd = buildGroupDefaults(darkGlassTheme);
    expect(gd.borderOpacity).toBe(darkGlassTheme.group.defaultBorderOpacity);
  });

  it('falls back borderEmissiveColor to borderColor when not set in theme', () => {
    const theme = {
      ...darkGlassTheme,
      group: {
        ...darkGlassTheme.group,
        defaultBorderEmissiveColor: undefined,
        defaultBorderColor: '#aabbcc',
      },
    };
    const gd = buildGroupDefaults(theme);
    expect(gd.borderEmissiveColor).toBe('#aabbcc');
  });

  it('uses theme borderEmissiveColor when provided', () => {
    const theme = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultBorderEmissiveColor: '#ff5500' },
    };
    const gd = buildGroupDefaults(theme);
    expect(gd.borderEmissiveColor).toBe('#ff5500');
  });

  it('falls back borderEmissiveIntensity to 0 when not set in theme', () => {
    const theme = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultBorderEmissiveIntensity: undefined },
    };
    const gd = buildGroupDefaults(theme);
    expect(gd.borderEmissiveIntensity).toBe(0);
  });

  it('uses theme borderEmissiveIntensity when provided', () => {
    const theme = {
      ...darkGlassTheme,
      group: { ...darkGlassTheme.group, defaultBorderEmissiveIntensity: 0.8 },
    };
    const gd = buildGroupDefaults(theme);
    expect(gd.borderEmissiveIntensity).toBe(0.8);
  });
});
