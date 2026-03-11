import { createContext } from 'react';
import type { IScrollSource } from './scrollSourceTypes';

export type ScrollDriverContextValue = {
  readonly setSource: (source: IScrollSource | null) => void;
};

export const ScrollDriverContext = createContext<ScrollDriverContextValue | null>(null);
