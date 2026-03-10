// ControlledProgressContext.tsx — Provided by ControlledInput, consumed by KeyboardInput.

import { createContext } from 'react';

/**
 * Provided by ControlledInput so KeyboardInput can call onChange instead of
 * writing directly to the engine when a controlled progress source is active.
 */
export type ControlledProgressContextValue = {
  readonly onChange: ((progress: number) => void) | undefined;
};

export const ControlledProgressContext = createContext<ControlledProgressContextValue | null>(null);
