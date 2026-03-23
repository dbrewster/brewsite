// Compact row of technical trust facts.

import type { JSX } from 'react';

/** Props for the TrustStrip component. */
export type TrustStripProps = {
  readonly items: readonly string[];
};

/**
 * Render technical trust facts as a compact separated row.
 * Used in the trust / ecosystem section.
 */
export function TrustStrip({ items }: TrustStripProps): JSX.Element {
  return (
    <div className="trust-strip">
      {items.map((item, i) => (
        <span key={item} className="trust-strip__item">
          {item}
          {i < items.length - 1 && (
            <span className="trust-strip__dot" aria-hidden="true">
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
