import type { DiagramTheme } from '@brewsite/diagram';
import { mergeTheme } from '@brewsite/diagram';
import { bundles } from '@brewsite/themes';

// Note: DiagramThemeNodeConfig uses 'default'-prefixed property names.
// iconDepthFactor is available as defaultIconDepthFactor on the theme and as a per-node override.
// iconStyle is available as defaultIconStyle on the theme.
export const brewflowTheme: DiagramTheme = mergeTheme(bundles.darkGlass.diagram.dark, {
  node: {
    defaultThickness: .2,      // was ~0.4 — much deeper prisms
    defaultMetalness: 0.75,     // was ~0.4 — more reflective
    defaultRoughness: 0.18,     // was ~0.3 — shinier, more specular highlights
    defaultIconStyle: 'extruded' as const,
    glowIntensity: 0.18,        // subtle bloom
    labelSizeFactor: 1.15,      // 15% larger primary labels
    sublabelSizeFactor: 1.1,    // 10% larger sublabels
  },
});
