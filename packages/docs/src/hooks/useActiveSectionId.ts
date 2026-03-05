// Convenience hook to read the active section id from DocsApp context.

import { useContext } from 'react';
import { DocsAppContext } from '../layout/DocsApp';

/**
 * Returns the id of the currently active section, as tracked by DocsApp's
 * IntersectionObserver. Returns an empty string if no section is active or
 * if used outside DocsApp.
 *
 * Use this hook in custom sidebar or progress indicator components.
 */
export function useActiveSectionId(): string {
  return useContext(DocsAppContext).activeId;
}
