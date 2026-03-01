import type { NavSection } from './nav/types';

export interface FlatRoute {
  label: string;
  fullPath: string;
}

export const flattenNav = (sections: NavSection[]): FlatRoute[] =>
  sections.flatMap((section) =>
    section.items.flatMap((item) =>
      item.path !== undefined ? [{ label: item.label, fullPath: item.path }] : [],
    ),
  );
