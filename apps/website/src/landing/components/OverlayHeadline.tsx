// Consistent eyebrow / headline / support cluster for scene overlays.

import type { JSX } from 'react';

/** Props for the OverlayHeadline component. */
export type OverlayHeadlineProps = {
  readonly eyebrow?: string;
  readonly headline: string;
  readonly support?: string;
  readonly tone?: 'cool' | 'warm';
};

/**
 * Render a consistent eyebrow/headline/support text cluster.
 * Used inside OverlayColumn for every scene's overlay messaging.
 */
export function OverlayHeadline({
  eyebrow,
  headline,
  support,
  tone = 'cool',
}: OverlayHeadlineProps): JSX.Element {
  const headlineClass = tone === 'warm' ? 'scene-punchline scene-punchline--warm' : 'scene-punchline';

  return (
    <div className="overlay-headline">
      {eyebrow && (
        <span className="eyebrow eyebrow--accent">{eyebrow}</span>
      )}
      <h2 className={headlineClass}>{headline}</h2>
      {support && <p className="body-text">{support}</p>}
    </div>
  );
}
