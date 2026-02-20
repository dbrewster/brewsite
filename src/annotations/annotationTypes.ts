/**
 * Annotation element types - complete implementation for Phase 12.
 */

import type { ReactNode } from 'react';

export type AnnotationPlacement =
  | { mode: 'fixed';
      reference: { x: 'left' | 'center' | 'right'; y: 'top' | 'middle' | 'bottom' };
      offset: { xPct: number; yPct: number }; }
  | { mode: 'follow';
      targetPartId: string;
      targetOffset?: [number, number, number];
      screenOffset?: { xPct: number; yPct: number }; };

export type AnnotationStyle = {
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: string;
  opacity?: number;
};

/**
 * Discriminated union for annotation content.
 *
 * - `{ node }`: inline React content passed directly at authoring time.
 * - `{ contentId }`: a stable string key resolved by the consumer at render
 *   time (e.g. from a content registry).  Enables serialisation of content
 *   references without bundling React trees into compiled output.
 */
export type AnnotationContent =
  | { node: ReactNode; contentId?: never }
  | { contentId: string; node?: never };

/** @deprecated Use AnnotationContent instead. */
export type AnnotationContentEntry = {
  label?: ReactNode;
  node?: ReactNode;
  contentId?: string;
};

export type AnnotationDefinition = {
  id: string;
  label: string;
  enabled?: boolean;
  content?: AnnotationContent;
  placement: AnnotationPlacement;
  style?: Partial<AnnotationStyle>;
};

export type AnnotationDefaults = {
  style: AnnotationStyle;
};

export type AnnotationResolved = Omit<AnnotationDefinition, 'style'> & {
  /** Resolved style is always a complete AnnotationStyle — never partial. */
  style: AnnotationStyle;
  screenPosition?: { x: number; y: number };
};

export const DEFAULT_ANNOTATION_DEFAULTS: AnnotationDefaults = {
  style: {
    fontSize: 14,
    color: '#ffffff',
    backgroundColor: '#000000',
    borderRadius: 4,
    padding: '8px 12px',
    opacity: 1,
  },
};
