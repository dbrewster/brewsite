// Nav manifest interface contracts for @brewsite/docs.

/**
 * A single navigation entry corresponding to exactly one <Section> in page content.
 * The `id` field must match the `id` prop on the corresponding Section component.
 */
export interface DocsNavSection {
  /** Section anchor id. Must match the <Section id="..."> prop. */
  readonly id: string;
  /** Display label shown in the sidebar. */
  readonly label: string;
}

/**
 * A group of related nav entries displayed under a shared header in the sidebar.
 */
export interface DocsNavGroup {
  /** Group header text displayed in the sidebar. */
  readonly title: string;
  /** Ordered list of section entries belonging to this group. */
  readonly sections: readonly DocsNavSection[];
}

/**
 * The fully typed nav manifest returned by defineDocsNav().
 * TId is the union of all section ids derived from the input literal.
 */
export interface DocsNav<TId extends string = string> {
  /** All nav groups in display order. */
  readonly groups: readonly DocsNavGroup[];
  /**
   * All section ids in order (flattened from groups).
   * Used by DocsApp to coordinate IntersectionObserver registration.
   */
  readonly allSectionIds: readonly TId[];
}
