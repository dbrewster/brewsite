// Typed layout primitive — renders a <section> anchor with id and data-section-id.

import type { ReactElement, ReactNode } from 'react';

/**
 * Props for Section. TId is typed as SectionId from the nav manifest.
 * A mismatch between `id` and the manifest's section ids is a TypeScript compile error.
 */
export interface SectionProps<TId extends string = string> {
  /**
   * Section id. Must match a DocsNavSection.id in the active nav manifest.
   * Typed as SectionId from the manifest so mismatches are compile errors.
   */
  id: TId;
  /**
   * Rendered as <h2> immediately after the section anchor.
   * Omit to suppress the heading (useful for sections that provide their own heading markup).
   */
  title?: string;
  children: ReactNode;
}

/**
 * Layout primitive for a docs section.
 *
 * Renders a <section> element with:
 * - `id` attribute: enables #anchor linking and hash navigation
 * - `data-section-id` attribute: IntersectionObserver target for active-section tracking
 * - Optional <h2> heading from `title` prop
 * - children rendered directly (no scroll, no engine, no special behavior)
 *
 * Section is a dumb presentational component. It does no dynamic registration.
 * Active-section tracking is driven entirely by DocsApp's IntersectionObserver.
 */
export function Section<TId extends string = string>({
  id,
  title,
  children,
}: SectionProps<TId>): ReactElement {
  return (
    <section id={id} data-section-id={id}>
      {title !== undefined ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
