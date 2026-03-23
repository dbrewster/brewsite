import type { JSX } from 'react';
import { WEBSITE_SECTIONS } from '../content/siteMap';
import { Scene00Hero } from './act0/scene_00_hero';
import { Scene01FlatWorld } from './act1/scene_01_flat_world';
import { Scene02aDimensionalShift } from './act2/scene_02a_dimensional_shift';
import { Scene02bBeyondDiagrams } from './act2/scene_02b_beyond_diagrams';
import { Scene03aTheCode } from './act3/scene_03a_the_code';
import { Scene03bPipeline } from './act3/scene_03b_pipeline';
import { Scene04Ecosystem } from './act4/scene_04_ecosystem';
import { Scene05Cta } from './act5/scene_05_cta';

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteFlowScenes: JSX.Element[] = [
  <Scene00Hero />,
  <Scene01FlatWorld />,
  <Scene02aDimensionalShift />,
  <Scene02bBeyondDiagrams />,
  <Scene03aTheCode />,
  <Scene03bPipeline />,
  <Scene04Ecosystem />,
  <Scene05Cta />,
];

export const websiteNavTargets: WebsiteNavTarget[] = WEBSITE_SECTIONS.map((s) => ({
  num: s.navNumber,
  label: s.navLabel,
  sceneId: s.sceneId,
}));
