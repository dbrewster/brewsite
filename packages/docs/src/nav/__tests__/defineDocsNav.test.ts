import { describe, it, expect } from 'vitest';
import { defineDocsNav } from '../defineDocsNav';

const NAV_INPUT = [
  {
    title: 'Getting Started',
    sections: [
      { id: 'installation', label: 'Installation' },
      { id: 'quick-start', label: 'Quick Start' },
    ],
  },
  {
    title: 'Reference',
    sections: [
      { id: 'api-reference', label: 'API Reference' },
    ],
  },
] as const;

describe('defineDocsNav', () => {
  it('returns groups in input order', () => {
    const result = defineDocsNav(NAV_INPUT);
    expect(result.docsNav.groups).toHaveLength(2);
    expect(result.docsNav.groups[0]?.title).toBe('Getting Started');
    expect(result.docsNav.groups[1]?.title).toBe('Reference');
  });

  it('returns allSectionIds flattened from all groups in order', () => {
    const result = defineDocsNav(NAV_INPUT);
    expect(result.docsNav.allSectionIds).toEqual([
      'installation',
      'quick-start',
      'api-reference',
    ]);
  });

  it('preserves section labels', () => {
    const result = defineDocsNav(NAV_INPUT);
    const s = result.docsNav.groups[0]?.sections[0];
    expect(s?.id).toBe('installation');
    expect(s?.label).toBe('Installation');
  });

  it('SectionId phantom value is falsy (undefined at runtime)', () => {
    const result = defineDocsNav(NAV_INPUT);
    // TypeScript: typeof result.SectionId is 'installation' | 'quick-start' | 'api-reference'
    // Runtime: value is undefined
    expect(result.SectionId).toBeUndefined();
  });
});
