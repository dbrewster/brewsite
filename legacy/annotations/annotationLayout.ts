import type {AnnotationStyle} from './annotationTypes';

export type LabelSize = {
  width: number;
  height: number;
  textWidth: number;
  textHeight: number;
};

export const computeLabelSize = (
  textWidth: number,
  textHeight: number,
  style: AnnotationStyle,
): LabelSize => {
  const paddedWidth = textWidth + style.paddingX * 2;
  const paddedHeight = textHeight + style.paddingY * 2;
  const width = Math.min(style.maxWidth, Math.max(style.minWidth, paddedWidth));
  const height = Math.max(style.minHeight, paddedHeight);
  return {
    width,
    height,
    textWidth,
    textHeight,
  };
};

export const computeAnchorOffset = (
  width: number,
  height: number,
  anchorX: AnnotationStyle['anchorX'],
  anchorY: AnnotationStyle['anchorY'],
): [number, number, number] => {
  let offsetX = 0;
  let offsetY = 0;

  if (anchorX === 'left') offsetX = width * 0.5;
  if (anchorX === 'right') offsetX = -width * 0.5;

  if (anchorY === 'top') offsetY = height * 0.5;
  if (anchorY === 'bottom') offsetY = -height * 0.5;

  return [offsetX, offsetY, 0];
};
