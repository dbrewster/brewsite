// Section label row — displays section number and label for navigation context.

import type { JSX } from 'react';

/** Props for the SectionLabelRow component. */
export type SectionLabelRowProps = {
  readonly number: string;
  readonly label: string;
};

/**
 * Render a compact section number + label row.
 * Used at the top of scene overlays to provide navigation context.
 */
export function SectionLabelRow({ number, label }: SectionLabelRowProps): JSX.Element {
  return (
    <div className="section-label-row">
      <span className="section-label-row__num">{number}</span>
      <span className="section-label-row__label">{label}</span>
    </div>
  );
}
