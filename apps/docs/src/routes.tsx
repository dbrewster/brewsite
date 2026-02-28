import type { NavSection } from './nav/types';

export interface FlatRoute {
  label: string;
  fullPath: string;
}

export const flattenNav = (sections: NavSection[]): FlatRoute[] =>
  sections.flatMap((section) => section.items.map((item) => ({ label: item.label, fullPath: item.path })));
