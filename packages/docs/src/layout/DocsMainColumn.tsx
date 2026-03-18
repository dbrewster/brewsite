// Main content column: block flow, no overflow, scrolls via window.
// Preserves the inner docs-content div for max-width and padding constraints.

import { forwardRef, type ReactNode, type ReactElement } from 'react';

export interface DocsMainColumnProps {
  children: ReactNode;
}

/**
 * The main content column in the DocsApp grid.
 *
 * Two-div structure (preserved from DocsScrollRegion):
 * - Outer div: grid column cell. No overflow-y, no height — window is the scroll source.
 * - Inner div (.docs-content): max-width + padding + centering. Unchanged from DocsScrollRegion.
 *
 * The ref is forwarded to the outer div for future use (e.g., SceneEngine positioning).
 * It is NOT passed to IntersectionObserver as root — the IntersectionObserver root is null (window).
 */
export const DocsMainColumn = forwardRef<HTMLDivElement, DocsMainColumnProps>(
  ({ children }, ref): ReactElement => {
    return (
      <div
        ref={ref}
        className="docs-main-column"
        style={{
          flex: 1,
          minWidth: 0,
          // No overflow-y. No height: 100vh. Window is the scroll source.
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

DocsMainColumn.displayName = 'DocsMainColumn';
