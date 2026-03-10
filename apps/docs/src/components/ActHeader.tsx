// CSS-only act header — no WebGL, no SceneEngine.
// Real HTML element with id for native anchor links.

import { type JSX } from 'react';

export interface ActHeaderProps {
  /**
   * Real HTML id for native anchor links (/docs#act-getting-started).
   * Also used by NavContext for sidebar active section detection.
   */
  id: string;
  title: string;
}

export function ActHeader({ id, title }: ActHeaderProps): JSX.Element {
  return (
    <section
      id={id}
      className="act-header"
      aria-label={`Act: ${title}`}
    >
      <div className="act-header__inner">
        <h2 className="act-header__title">{title}</h2>
      </div>
    </section>
  );
}
