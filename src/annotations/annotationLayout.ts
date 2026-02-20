/**
 * Annotation layout calculations.
 */

import type { AnnotationStyle } from './annotationTypes';

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
  const paddingX = 12; // Default padding
  const paddingY = 8;
  const paddedWidth = textWidth + paddingX * 2;
  const paddedHeight = textHeight + paddingY * 2;
  const maxWidth = 400; // Default max width
  const minWidth = 80; // Default min width
  const minHeight = 32; // Default min height

  const width = Math.min(maxWidth, Math.max(minWidth, paddedWidth));
  const height = Math.max(minHeight, paddedHeight);
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
  anchorX: 'left' | 'center' | 'right' = 'center',
  anchorY: 'top' | 'middle' | 'bottom' = 'middle',
): [number, number, number] => {
  let offsetX = 0;
  let offsetY = 0;

  if (anchorX === 'left') offsetX = width * 0.5;
  if (anchorX === 'right') offsetX = -width * 0.5;

  if (anchorY === 'top') offsetY = height * 0.5;
  if (anchorY === 'bottom') offsetY = -height * 0.5;

  return [offsetX, offsetY, 0];
};
