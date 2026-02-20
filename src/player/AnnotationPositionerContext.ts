import { createContext, useContext } from 'react';
import type { AnnotationPositioner } from './AnnotationPositioner';

export const AnnotationPositionerContext = createContext<AnnotationPositioner | null>(null);

export const useAnnotationPositioner = (): AnnotationPositioner => {
  const ctx = useContext(AnnotationPositionerContext);
  if (!ctx) {
    throw new Error('[useAnnotationPositioner] must be inside <ScenePlayer>');
  }
  return ctx;
};
