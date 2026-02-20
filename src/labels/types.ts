/**
 * Label element types.
 */

export type LabelStyle = {
  color?: string;
  lineColor?: string;
  fontSize?: number;
  lineOpacity?: number;
  labelOpacity?: number;
  lineThickness?: number;
};

export type LabelDefinition = {
  id: string;
  text: string;
  targetPartId: string;
  labelOffset?: [number, number, number];
  enabled?: boolean;
  style?: LabelStyle;
};

export type LabelResolved = LabelDefinition & {
  screenPosition?: { x: number; y: number };
};
