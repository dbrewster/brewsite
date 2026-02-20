import { createContext } from 'react';
import type { VariableStore } from './VariableStore';

export const VariableStoreContext = createContext<VariableStore | null>(null);
