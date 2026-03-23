// Navigation metadata and section identifiers for the homepage flow.

/** Stable identifier for a website homepage section. */
export type WebsiteSectionId =
  | 'hero'
  | 'problem'
  | 'surfaces'
  | 'primitives'
  | 'authoring'
  | 'team'
  | 'trust'
  | 'cta';

/** Metadata for a single homepage section — consumed by nav and telemetry. */
export type WebsiteSectionMeta = {
  readonly id: WebsiteSectionId;
  readonly navNumber: string;
  readonly navLabel: string;
  readonly sceneId: string;
  readonly telemetryName: string;
};

/** Ordered section metadata for the homepage. */
export const WEBSITE_SECTIONS: readonly WebsiteSectionMeta[] = [
  {
    id: 'hero',
    navNumber: '00',
    navLabel: 'BrewSite',
    sceneId: 'website-hero-00',
    telemetryName: 'hero',
  },
  {
    id: 'problem',
    navNumber: '01',
    navLabel: 'The Problem',
    sceneId: 'website-flat-world',
    telemetryName: 'problem',
  },
  {
    id: 'surfaces',
    navNumber: '02',
    navLabel: 'Dimensional',
    sceneId: 'website-dimensional-shift',
    telemetryName: 'surfaces',
  },
  {
    id: 'primitives',
    navNumber: '03',
    navLabel: 'The Toolkit',
    sceneId: 'website-beyond-diagrams',
    telemetryName: 'primitives',
  },
  {
    id: 'authoring',
    navNumber: '04',
    navLabel: 'The Code',
    sceneId: 'website-the-code',
    telemetryName: 'authoring',
  },
  {
    id: 'team',
    navNumber: '05',
    navLabel: 'The Engine',
    sceneId: 'website-pipeline',
    telemetryName: 'team',
  },
  {
    id: 'trust',
    navNumber: '06',
    navLabel: 'Ecosystem',
    sceneId: 'website-ecosystem',
    telemetryName: 'trust',
  },
  {
    id: 'cta',
    navNumber: '07',
    navLabel: 'Get Started',
    sceneId: 'website-get-started',
    telemetryName: 'cta',
  },
];

/** Look up a section by its stable ID. */
export function getSection(id: WebsiteSectionId): WebsiteSectionMeta | undefined {
  return WEBSITE_SECTIONS.find((s) => s.id === id);
}

/** Look up a section by its scene ID. */
export function getSectionBySceneId(sceneId: string): WebsiteSectionMeta | undefined {
  return WEBSITE_SECTIONS.find((s) => s.sceneId === sceneId);
}
