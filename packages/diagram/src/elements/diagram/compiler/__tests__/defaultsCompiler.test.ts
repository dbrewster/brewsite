// Tests for defaultsCompiler — buildNodeDefaults, buildEdgeDefaults, buildGroupDefaults.

import { describe, it, expect } from 'vitest';
import { buildNodeDefaults, buildEdgeDefaults, buildGroupDefaults } from '../defaultsCompiler';
import { darkGlassTheme } from '../../themes/darkGlass';

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

  it('reads iconDepthFactor from theme.node.defaultIconDepthFactor', () => {
    const customTheme = { ...darkGlassTheme, node: { ...darkGlassTheme.node, defaultIconDepthFactor: 0.5 } };
    const nd = buildNodeDefaults(customTheme);
    expect(nd.iconDepthFactor).toBe(0.5);
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
    const customTheme = { ...darkGlassTheme, edge: { ...darkGlassTheme.edge, defaultThickness: 0.08 } };
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
    expect(ed.flowTurnRadius).toBe(darkGlassTheme.edge.flowTurnRadius);
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
