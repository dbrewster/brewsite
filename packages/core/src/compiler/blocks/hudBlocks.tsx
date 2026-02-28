// DSL authoring components for the HUD overlay system.
// <Hud> acts as a container; <HudItem> compiles into HudItemDefinition on SceneFrame.

import type { CSSProperties, ReactNode } from 'react';
import { registerNode } from '../registry';
import type { HudItemDefinition } from '../../hud/types';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';

export type HudProps = {
  children?: ReactNode;
};

export type HudItemDslProps = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, item is excluded from compiled hudPrimitives. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the rendered HudItem container. */
  className?: string;
  /** Optional inline styles. Positioning is fully CSS-owned — no placement logic here. */
  style?: CSSProperties;
  /**
   * React content. Passed as JSX children between the tags — not as a prop.
   * May include animejs transition wrappers. Not compiled as DSL.
   */
  children?: ReactNode;
};

/** Container DSL component. Compiles its children. No output of its own. */
export const Hud = (_props: HudProps) => null;
Hud.displayName = 'Hud';

/**
 * Authoring DSL component for a single HUD item.
 * Compiles into a HudItemDefinition pushed to SceneFrame.hudItems.
 *
 * @see AnimeJS presets module: `@brewsite/core/hud/animejs`
 */
export const HudItem = (_props: HudItemDslProps) => null;
HudItem.displayName = 'HudItem';

registerNode(Hud, (node: import('react').ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  helpers.compileChildren(node, api);
});

registerNode(HudItem, (node: import('react').ReactElement, api: CompileApi) => {
  const props = node.props as HudItemDslProps;
  const def: HudItemDefinition = {
    id: props.id,
    children: props.children ?? null,
  };
  if (props.enabled !== undefined) def.enabled = props.enabled;
  if (props.className !== undefined) def.className = props.className;
  if (props.style !== undefined) def.style = props.style;
  api.pushHudItem(def);
});
