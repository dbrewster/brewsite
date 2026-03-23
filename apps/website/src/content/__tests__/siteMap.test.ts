// Tests for the homepage site map and section metadata.

import { describe, it, expect } from 'vitest';
import {
  WEBSITE_SECTIONS,
  getSection,
  getSectionBySceneId,
} from '../siteMap';
import type { WebsiteSectionId } from '../siteMap';

describe('WEBSITE_SECTIONS', () => {
  const ALL_IDS: WebsiteSectionId[] = [
    'hero',
    'problem',
    'surfaces',
    'primitives',
    'authoring',
    'team',
    'trust',
    'cta',
  ];

  it('contains exactly 8 sections', () => {
    expect(WEBSITE_SECTIONS).toHaveLength(8);
  });

  it('covers every WebsiteSectionId', () => {
    const ids = WEBSITE_SECTIONS.map((s) => s.id);
    for (const id of ALL_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('has unique section ids', () => {
    const ids = WEBSITE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique scene ids', () => {
    const sceneIds = WEBSITE_SECTIONS.map((s) => s.sceneId);
    expect(new Set(sceneIds).size).toBe(sceneIds.length);
  });

  it('has unique nav numbers', () => {
    const nums = WEBSITE_SECTIONS.map((s) => s.navNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('every section has a non-empty navLabel', () => {
    for (const section of WEBSITE_SECTIONS) {
      expect(section.navLabel).toBeTruthy();
    }
  });

  it('every section has a non-empty telemetryName', () => {
    for (const section of WEBSITE_SECTIONS) {
      expect(section.telemetryName).toBeTruthy();
    }
  });

  it('sections are ordered from 00 to 07', () => {
    const nums = WEBSITE_SECTIONS.map((s) => s.navNumber);
    expect(nums).toEqual(['00', '01', '02', '03', '04', '05', '06', '07']);
  });
});

describe('getSection', () => {
  it('returns the correct section for a valid id', () => {
    const hero = getSection('hero');
    expect(hero).toBeDefined();
    expect(hero!.id).toBe('hero');
    expect(hero!.sceneId).toBe('website-hero-00');
  });

  it('returns undefined for unknown id', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getSection('nonexistent' as any)).toBeUndefined();
  });
});

describe('getSectionBySceneId', () => {
  it('returns the correct section for a known sceneId', () => {
    const section = getSectionBySceneId('website-get-started');
    expect(section).toBeDefined();
    expect(section!.id).toBe('cta');
  });

  it('returns undefined for unknown sceneId', () => {
    expect(getSectionBySceneId('unknown-scene')).toBeUndefined();
  });
});
