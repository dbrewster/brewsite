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
 * @intentional_stub This component intentionally returns null. It is a documented
 * extension point — the data model (InputHudState) and event plumbing
 * (onActionFired from ActionInputController) are fully implemented. The rendering
 * layer is deferred to a future release. Do NOT remove this stub; its presence
 * in the public API surface is intentional.
 *
 * Implementation: When ready to implement, render the action labels from
 * props.state.actions using an absolutely-positioned overlay inside the
 * EngineOverlayHost. The HudPhaseContext pattern from the existing HUD
 * system provides a reference implementation.
 */
export const InputHud = (_props: InputHudProps): null => {
  return null;
};
