import { createContext, useContext } from 'react';
import type { HudPhase } from './types';

export const HudPhaseContext = createContext<HudPhase | null>(null);

export const useHudPhase = (): HudPhase | null => useContext(HudPhaseContext);
