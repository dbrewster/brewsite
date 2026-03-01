import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { LabelResolved } from './types';
import { useLabelPositioner } from '../player/LabelPositionerContext';

export const LabelItem = ({ label }: { label: LabelResolved }): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const positioner = useLabelPositioner();

  useEffect(() => {
    positioner.registerElement(label.id, ref.current);
    return () => positioner.registerElement(label.id, null);
  }, [label.id, positioner]);

  const resolvedLabelColor = label.style?.color === 'target-color'
    ? '#ffffff'
    : label.style?.color ?? '#ffffff';
  const resolvedLineColor = label.style?.lineColor === 'target-color'
    ? 'rgba(255,255,255,0.8)'
    : label.style?.lineColor ?? 'rgba(255,255,255,0.8)';
  const style = useMemo<CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    color: `var(--label-color, ${resolvedLabelColor})`,
    fontSize: label.style?.fontSize ?? 12,
    opacity: label.style?.labelOpacity ?? 1,
  }), [label.style, resolvedLabelColor]);

  const lineStyle = useMemo<CSSProperties>(() => ({
    position: 'absolute',
    left: 'var(--label-line-origin-x, 0px)',
    top: 'var(--label-line-origin-y, 0px)',
    width: 'var(--label-line-length, 0px)',
    height: 0,
    borderTopWidth: `var(--label-line-thickness, ${label.style?.lineThickness ?? 1}px)`,
    borderTopStyle: 'solid',
    borderTopColor: `var(--label-line-color, ${resolvedLineColor})`,
    opacity: label.style?.lineOpacity ?? 1,
    transformOrigin: '0 0',
    transform: 'rotate(var(--label-line-angle, 0deg))',
    pointerEvents: 'none',
  }), [label.style, resolvedLineColor]);

  return (
    <div ref={ref} style={style}>
      <span style={lineStyle} />
      {label.text}
    </div>
  );
};
