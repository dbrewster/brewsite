import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export const ContentSlotContext = createContext<Record<string, ReactNode>>({});

export const useContentSlot = (contentId: string): ReactNode | undefined => {
  const slots = useContext(ContentSlotContext);
  return slots[contentId];
};
