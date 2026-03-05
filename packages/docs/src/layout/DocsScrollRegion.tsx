// Continuous scroll content region.

import { forwardRef, type ReactNode, type ReactElement } from 'react';

interface DocsScrollRegionProps {
  children: ReactNode;
}

/**
 * The scrollable content column in the DocsApp layout.
 *
 * Renders a div with `overflow-y: auto; height: 100vh` so the content
 * column scrolls independently of the sidebar. The ref is forwarded to
 * DocsApp for IntersectionObserver registration (`root: scrollEl`).
 *
 * Content is padded and max-width constrained for readability:
 * - max-width: var(--content-max-width, 820px)
 * - padding: 48px 48px on wide viewports
 */
export const DocsScrollRegion = forwardRef<HTMLDivElement, DocsScrollRegionProps>(
  ({ children }, ref): ReactElement => {
    return (
      <div
        ref={ref}
        className="docs-scroll-region"
        style={{
          overflowY: 'auto',
          height: '100vh',
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          className="docs-content"
          style={{
            maxWidth: 'var(--content-max-width, 820px)',
            padding: '48px 48px',
            margin: '0 auto',
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

DocsScrollRegion.displayName = 'DocsScrollRegion';
