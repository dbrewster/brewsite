// Factory for type-safe docs navigation manifests.

import type { DocsNav, DocsNavGroup } from './types';

type NavInputGroup = {
  readonly title: string;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly label: string }>;
};

type ExtractSectionIds<T extends ReadonlyArray<NavInputGroup>> =
  T[number]['sections'][number]['id'];

/**
 * Creates a typed nav manifest from a const-inferred array literal.
 *
 * Returns:
 * - `docsNav`: the DocsNav<TId> manifest for use with DocsApp
 * - `SectionId`: a phantom type witness — use only as:
 *     `export type SectionId = typeof navDef.SectionId;`
 *   Never access the value at runtime.
 *
 * @example
 * ```typescript
 * const navDef = defineDocsNav([
 *   { title: 'Getting Started', sections: [
 *     { id: 'installation', label: 'Installation' },
 *   ]},
 * ] as const);
 * export const docsNav = navDef.docsNav;
 * export type SectionId = typeof navDef.SectionId;
 * ```
 */
export function defineDocsNav<const T extends ReadonlyArray<NavInputGroup>>(
  groups: T,
): {
  docsNav: DocsNav<ExtractSectionIds<T>>;
  /** Phantom type witness — do not access the value. Use typeof for type extraction. */
  SectionId: ExtractSectionIds<T>;
} {
  const allSectionIds = groups.flatMap((g) => g.sections.map((s) => s.id));
  return {
    docsNav: {
      groups: groups as readonly DocsNavGroup[],
      allSectionIds: allSectionIds as ExtractSectionIds<T>[],
    },
    SectionId: undefined as unknown as ExtractSectionIds<T>,
  };
}
