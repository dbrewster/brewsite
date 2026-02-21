import type { LabelDefinition, LabelResolved } from '../labels/types';
export type LabelCompileContext = { sceneProgress: number };

/**
 * Compiles label definitions.
 * Stub - implemented in Phase 4
 */
export const compileLabels = (labels: LabelDefinition[], _context: LabelCompileContext): LabelResolved[] => {
  return labels.filter((l) => l.enabled !== false) as unknown as LabelResolved[];
};
