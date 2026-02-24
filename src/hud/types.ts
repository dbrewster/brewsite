// Defines the HUD item data contracts: HudItemDefinition (authored) and HudItemResolved (compiled/rendered).

import type { CSSProperties, ReactNode } from 'react';

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
  /** React content to render inside this HUD slot. */
  node: ReactNode;
};

/**
 * A compiled/resolved HUD item. Currently a pass-through of HudItemDefinition.
 * Reserved as the stable seam for future defaulting or merging logic in hudCompiler.ts.
 */
export type HudItemResolved = HudItemDefinition;
