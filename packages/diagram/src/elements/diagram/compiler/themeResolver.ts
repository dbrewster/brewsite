// Theme resolution helpers extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramTheme,
  DiagramThemeRenderConfig,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramExitConfig,
  DiagramEnterConfig,
} from '../types';

export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig {
  const labelScale   = theme.sceneTheme?.fontSize.label   ?? 1.0;
  const captionScale = theme.sceneTheme?.fontSize.caption ?? 1.0;

  return {
    envMapUrl:        theme.environment.envMapUrl,
    envMapIntensity:  theme.environment.envMapIntensity,
    skyColor:         theme.environment.skyColor,
    horizonColor:     theme.environment.horizonColor,
    nodeEnvMapIntensity: theme.node.nodeEnvMapIntensity ?? 0.15,
    nodeGlowIntensity: theme.node.glowIntensity,
    nodeGlowSpread:    theme.node.glowSpread,
    nodeCornerRadius:  theme.node.cornerRadius,
    use3DArrows:       theme.edge.use3DArrows,
    edgeSmoothness:    theme.edge.smoothness,
    edgeMetalness:     theme.edge.defaultMetalness,
    edgeRoughness:     theme.edge.defaultRoughness,
    edgeFlowSpeed:     theme.edge.defaultFlowSpeed,
    edgeFlowWidth:     theme.edge.defaultFlowWidth,
    edgeTubeRadialSegments: theme.edge.tubeRadialSegments,
    groupBorderMetalness:    theme.group.borderMetalness,
    groupBorderRoughness:    theme.group.borderRoughness,
    groupBorderSideDarken:   theme.group.borderSideDarken,
    groupBorderEdgeDarken:   theme.group.borderEdgeDarken,
    edgeFlowPulseIntensity:  theme.edge.flowPulseIntensity,
    nodeLabelFontSizeBase:   theme.node.labelFontSizeBase,
    nodeSublabelFontSizeBase: theme.node.sublabelFontSizeBase,
    // Font URL: explicit theme.fontUrl takes precedence over sceneTheme fallback.
    fontUrl:           theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl,
    // Size factors composed with SceneTheme font size scale:
    effectiveLabelSizeFactor:    theme.node.labelSizeFactor * labelScale,
    effectiveSublabelSizeFactor: theme.node.sublabelSizeFactor * captionScale,
    // SDF glyph size: use troika's default (64) unless the theme explicitly overrides.
    // Lower values (e.g. 32) increase atlas capacity but risk overflow when combined
    // with improper disposal — prefer correct disposal over reduced glyph size.
    nodeSdfGlyphSize: theme.sdfGlyphSize ?? 64,
    nodeLabelPadding: theme.node.defaultLabelPadding,
  };
}

export function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | undefined {
  if (!dsl) return undefined;
  return {
    to: dsl.to,
    fade: dsl.fade ?? true,
    easing: dsl.easing ?? 'ease',
  };
}

export function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | undefined {
  if (!dsl) return undefined;
  return {
    from: dsl.from,
    fade: dsl.fade ?? true,
    easing: dsl.easing ?? 'ease',
  };
}
