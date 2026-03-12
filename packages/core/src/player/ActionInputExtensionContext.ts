// ActionInputExtensionContext.ts — React context for plugin onUnknownAction handlers.

import { createContext } from 'react';
import type { ActionInputHandler } from '../input/ActionInputController';

/** Merged onUnknownAction callback from all WidgetPlugin.getActionInputExtension() results. */
export type ActionInputExtension = NonNullable<ActionInputHandler['onUnknownAction']>;

export const ActionInputExtensionContext = createContext<ActionInputExtension | null>(null);
