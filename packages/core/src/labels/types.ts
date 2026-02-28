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
