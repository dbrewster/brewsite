import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { LabelResolved } from './types';
import { useAnnotationPositioner } from '../player/AnnotationPositionerContext';

export const LabelItem = ({ label }: { label: LabelResolved }): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const positioner = useAnnotationPositioner();

  useEffect(() => {
    positioner.registerElement(label.id, ref.current);
    return () => positioner.registerElement(label.id, null);
  }, [label.id, positioner]);

  const style = useMemo<CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    color: label.style?.color ?? '#ffffff',
    fontSize: label.style?.fontSize ?? 12,
    opacity: label.style?.labelOpacity ?? 1,
  }), [label.style]);

  return (
    <div ref={ref} style={style}>
      {label.text}
    </div>
  );
};
