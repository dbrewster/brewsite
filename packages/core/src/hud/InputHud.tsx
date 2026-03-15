// InputHud.tsx — Deferred InputHud component. Stub for future rendering.
// This file establishes the component contract. Rendering is not implemented yet.

import type { InputHudState } from './inputHudTypes';

export type InputHudProps = {
  state: InputHudState;
  visible?: boolean;
};

/**
 * InputHud — Renders an overlay showing available input actions.
 *
 * DEFERRED: This component returns null. It is a placeholder for future
 * implementation. The data model (InputHudState) and event plumbing
 * (onActionFired from ActionInputController) are implemented in this release.
 */
export const InputHud = (_props: InputHudProps): null => {
  return null;
};
