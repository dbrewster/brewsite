// Defines the HUD item data contracts: HudItemDefinition (authored) and HudItemResolved (compiled/rendered).

import type { CSSProperties, ReactNode } from 'react';

export type HudPhase = 'enter' | 'exit';

/**
 * An authored HUD item definition — written by scene authors inside <HudItem>.
 * Stored on SceneFrame.hudItems during compilation.
 */
export type HudItemDefinition = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, excluded from compiled output. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the root div. */
  className?: string;
  /** Optional inline styles applied to the root div. All positioning is CSS-owned by the consumer. */
  style?: CSSProperties;
  /**
   * React content for this HUD slot. Passed as JSX children between the tags.
   * May be any ReactNode — including animejs transition wrappers from src/hud/animejs/.
   * Stored as an opaque JS object by the compiler; rendered lazily by React inside ScenePlayer.
   */
  children: ReactNode;
};

/**
 * A compiled/resolved HUD item. Currently a pass-through of HudItemDefinition.
 * Reserved as the stable seam for future defaulting or merging logic in hudCompiler.ts.
 */
export type HudItemResolved = HudItemDefinition & {
  /** Unique instance id for React keying when multiple scenes overlap. */
  instanceId: string;
  /** Whether this HUD item is entering or exiting during a transition block. */
  phase?: HudPhase;
};
