/**
 * Label element types.
 */

export type LabelColor = 'target-color' | (string & {});

export type LabelStyle = {
  /**
   * Text color.
   * Use `'target-color'` to inherit the resolved color of the target body part
   * at runtime.
   */
  color?: LabelColor;
  /**
   * Leader-line color.
   * Use `'target-color'` to inherit the resolved color of the target body part
   * at runtime.
   */
  lineColor?: LabelColor;
  fontSize?: number | string;
  lineOpacity?: number;
  labelOpacity?: number;
  lineThickness?: number;
  /**
   * CSS font-family override for this label.
   * When absent, the label inherits font-family from its DOM ancestor.
   * If EngineOverlayHost injects --brewsite-font-family via SceneTheme,
   * labels will inherit it automatically via CSS cascade (fontFamily is
   * a CSS inherited property) without needing this field.
   *
   * Use this field for per-label font overrides only.
   */
  fontFamily?: string;
};

export type LabelDefinition = {
  id: string;
  text: string;
  labelOffset?: [number, number, number];
  enabled?: boolean;
  style?: LabelStyle;
};

export type LabelResolved = LabelDefinition & {
  targetPartId: string;
  screenPosition?: { x: number; y: number };
};
