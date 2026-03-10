// Real HTML prose section in document flow.
// id attribute enables native anchor links.

import { type JSX, type ReactNode } from 'react';

export interface ProseBlockProps {
  /**
   * Real HTML id — enables native anchor links (/docs#installation-prose).
   * Registered with NavContext on mount for sidebar active section detection.
   */
  id: string;
  children: ReactNode;
  className?: string;
}

export function ProseBlock({ id, children, className }: ProseBlockProps): JSX.Element {
  return (
    <section
      id={id}
      className={`prose-block${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="prose-block__content">
        {children}
      </div>
    </section>
  );
}
