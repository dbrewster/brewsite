import type {ReactNode} from 'react';

// Legacy modes remain for compatibility; normalization coerces to 'screen'.
export type AnnotationMode = 'screen' | 'world' | 'hud' | 'hud-screen';

export type AnnotationTarget =
  | { targetPartId: string; targetPoint?: never }
  | { targetPartId?: never; targetPoint: [number, number, number] };

export type AnnotationScreenReferenceX = 'left' | 'center' | 'right' | 'model';
export type AnnotationScreenReferenceY = 'top' | 'center' | 'bottom' | 'model';

export type AnnotationLabelAnchorScreen = {
  reference: {
    x: AnnotationScreenReferenceX;
    y: AnnotationScreenReferenceY;
  };
  offset: {
    xPct: number;
    yPct: number;
  };
};

export type AnnotationLabelAnchorLegacy =
  | { labelPosition: [number, number, number]; labelOffset?: never }
  | { labelPosition?: never; labelOffset: [number, number, number] };

export type AnnotationLabelAnchor = AnnotationLabelAnchorScreen | AnnotationLabelAnchorLegacy;

export type AnnotationContentEntry = {
  label?: ReactNode;
  hud?: ReactNode;
  node?: ReactNode;
  fullscreen?: boolean;
};

export type AnnotationContentMap = Record<string, AnnotationContentEntry>;

export type AnnotationVisibility = {
  isVisible: boolean;
  minDistance: number;
  maxDistance: number;
};

export type AnnotationFontFamily = 'Space Grotesk' | 'General Sans' | 'Default';

export type AnnotationCssStyle = Record<string, string | number>;

export type AnnotationStyle = {
  textColor: string;
  fontSize: number;
  fontWeight?: 400 | 500 | 600 | 700;
  fontFamily?: AnnotationFontFamily;
  backgroundColor: string;
  backgroundOpacity: number;
  labelOpacity: number;
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  lineColor: string;
  lineOpacity: number;
  lineThickness: number;
  billboard: boolean;
  depthTestLabel: boolean;
  depthTestLine: boolean;
  anchorX: 'left' | 'center' | 'right';
  anchorY: 'top' | 'middle' | 'bottom';
  allowRoll: boolean;
  maxWidth: number;
  minWidth: number;
  minHeight: number;
  scaleWithDistance: boolean;
  minScale: number;
  maxScale: number;
  containerCss?: AnnotationCssStyle;
  css?: AnnotationCssStyle;
};

export type AnnotationDefinitionScreen = {
  id: string;
  label?: string;
  mode?: AnnotationMode;
  target?: AnnotationTarget;
  labelAnchor?: AnnotationLabelAnchor;
  worldScale?: number;
  style?: Partial<AnnotationStyle>;
  visibility?: Partial<AnnotationVisibility>;
  enabled?: boolean;
  contentId?: string;
  content?: AnnotationContentEntry;
};

export type AnnotationDefinition = AnnotationDefinitionScreen;

export type AnnotationDefaults = {
  style: AnnotationStyle;
  visibility: AnnotationVisibility;
};

export type AnnotationConfig = {
  version: string;
  defaults: AnnotationDefaults;
  annotations: AnnotationDefinition[];
};
