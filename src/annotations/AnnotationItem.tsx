import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { AnnotationResolved } from './annotationTypes';
import { useAnnotationPositioner } from '../player/AnnotationPositionerContext';
import { useContentSlot } from '../player/ContentSlotContext';

export const AnnotationItem = ({ annotation }: { annotation: AnnotationResolved }): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const positioner = useAnnotationPositioner();

  useEffect(() => {
    positioner.registerElement(annotation.id, ref.current);
    return () => positioner.registerElement(annotation.id, null);
  }, [annotation.id, positioner]);

  const slotContent = useContentSlot(
    annotation.content && 'contentId' in annotation.content ? (annotation.content.contentId ?? '') : '',
  );

  const inlineStyle = useMemo<CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    color: annotation.style?.color,
    backgroundColor: annotation.style?.backgroundColor,
    borderRadius: annotation.style?.borderRadius,
    padding: annotation.style?.padding,
    opacity: annotation.style?.opacity,
    fontSize: annotation.style?.fontSize,
  }), [annotation.style]);

  const resolvedContent =
    annotation.content && 'node' in annotation.content
      ? annotation.content.node
      : slotContent ?? annotation.label;

  return (
    <div ref={ref} style={inlineStyle} aria-label={annotation.label}>
      {resolvedContent}
    </div>
  );
};
