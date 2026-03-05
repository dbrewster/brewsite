// Context carrying the shared Map of TextBox children, keyed by widgetId.
// Provided by corePlugin().wrapProvider; consumed by EngineOverlayHost.

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Provides a shared Map from widgetId to React children for all TextBox instances.
 * React children cannot be stored in VariableStore (JsonPrimitive only), so they
 * are carried via this context. TextBoxWidget.apply() writes into this map;
 * EngineOverlayHost reads from it when rendering positioned divs.
 */
export const TextBoxChildrenContext =
  createContext<Map<string, ReactNode>>(new Map());

/**
 * Hook to read the shared TextBox children map from context.
 * Returns the same Map reference that TextBoxWidget instances write into.
 */
export const useTextBoxChildren = (): Map<string, ReactNode> =>
  useContext(TextBoxChildrenContext);
