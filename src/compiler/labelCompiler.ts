import type { LabelDefinition, LabelResolved } from '../labels/types';
import type { SceneFrameContext } from './sceneTypes';

/**
 * Compiles label definitions.
 * Stub - implemented in Phase 4
 */
export const compileLabels = (labels: LabelDefinition[], _context: SceneFrameContext): LabelResolved[] => {
  return labels.filter((l) => l.enabled !== false) as unknown as LabelResolved[];
};
