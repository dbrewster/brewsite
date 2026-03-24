// React context providing the LabelPositioner instance to LabelItem.

import { createContext, useContext } from 'react';
import type { LabelPositioner } from './LabelPositioner';

export const LabelPositionerContext = createContext<LabelPositioner | null>(null);

export const useLabelPositioner = (): LabelPositioner => {
  const ctx = useContext(LabelPositionerContext);
  if (!ctx) {
    throw new Error('[useLabelPositioner] must be used inside <SceneEngine>');
  }
  return ctx;
};
