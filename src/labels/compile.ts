/**
 * Label element compilation.
 */

import type { LabelDefinition } from './types';
import type { ElementTransitionSpec, TransitionContext } from '../compiler/transitions/transitionTypes';

export const labelTransitionSpec: ElementTransitionSpec<LabelDefinition[]> = {
  exit: (labels: LabelDefinition[]) => labels.map(l => ({ ...l, enabled: false })),
  enter: (labels: LabelDefinition[], ctx: TransitionContext) =>
    labels.map(l => ({ ...l, enabled: l.enabled !== false && ctx.tEnter > 0.01 })),
  interpolate: (_from: LabelDefinition[], to: LabelDefinition[], _ctx: TransitionContext) => to,
};
