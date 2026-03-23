// Proof chip rail — renders short labels such as "Diagrams", "Slides", "Docs".

import type { JSX } from 'react';

/** Props for the ProofRail component. */
export type ProofRailProps = {
  readonly items: readonly string[];
};

/**
 * Render proof chips in a horizontal wrapping row.
 * Used beneath the hero support line and in scope sections.
 */
export function ProofRail({ items }: ProofRailProps): JSX.Element {
  return (
    <div className="proof-rail">
      {items.map((item) => (
        <span key={item} className="proof-rail__chip">
          {item}
        </span>
      ))}
    </div>
  );
}
