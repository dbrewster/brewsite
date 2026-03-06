// packages/slides/src/player/useSlideNotes.ts
// Hook for reading speaker notes from VariableStore.
// Fully implemented for v1.0; used by PresenterView.

import { useVariable } from '@brewsite/core';
// NOTE: `useVariable` is exported from @brewsite/core's widget/index.ts.
// `VariableStoreContext` is NOT exported from @brewsite/core and must NOT be used.
import { SLIDE_META_NAMESPACE } from '../widget/SlideMetaWidget';

/**
 * Reads the speaker notes for the slide with the given key.
 * Returns undefined when no notes were authored.
 *
 * Must be used inside an EngineProvider subtree.
 * Reactively re-renders when the notes value changes in VariableStore.
 *
 * @param slideKey - The stable slide key (= Scene id) used to look up notes.
 */
export function useSlideNotes(slideKey: string): string | undefined {
  // useVariable(namespace, key) — subscribes to VariableStore and returns
  // the current value reactively. Returns undefined if no engine is mounted.
  const raw = useVariable(SLIDE_META_NAMESPACE, `${slideKey}.notes`);
  return typeof raw === 'string' ? raw : undefined;
}
