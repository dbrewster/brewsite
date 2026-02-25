/**
 * Label element types.
 */

export type LabelStyle = {
  color?: string;
  lineColor?: string;
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
