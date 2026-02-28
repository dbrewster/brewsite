import { createContext } from 'react';
import type { ReactElement } from 'react';

export type SceneRegistrationValue = {
  register: (id: string, element: ReactElement) => void;
  unregister: (id: string) => void;
};

export const SceneRegistrationContext = createContext<SceneRegistrationValue | null>(null);
