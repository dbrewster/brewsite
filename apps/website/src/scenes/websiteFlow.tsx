import { Fragment } from 'react';
import type { JSX } from 'react';
import { scene00Hero } from './act0/scene_00_hero';
import { scene01CoreIntro } from './act1_act2/scene_01_core_intro';
import { scene02CoreBaked } from './act1_act2/scene_02_core_baked';
import { scene01ModelWide } from './act3_act4/scene_01_model';
import { scene02Meeting } from './act3_act4/scene_02_meeting';
import { scene01SimpleDiagram } from './act5_act6/scene_01_simple_diagram';
import { scene02ArchOverview } from './act5_act6/scene_02_arch_overview';
import { scene03ArchDetail } from './act5_act6/scene_03_arch_detail';
import { scene02Combined } from './act7/scene_02_combined';
import { scene01Github } from './act8/scene_01_github';

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteFlowScenes: JSX.Element[] = [
  <Fragment key="website-hero-00">{scene00Hero}</Fragment>,
  <Fragment key="website-presentation-01">{scene01CoreIntro}</Fragment>,
  <Fragment key="website-presentation-02">{scene02CoreBaked}</Fragment>,
  <Fragment key="website-model-01">{scene01ModelWide}</Fragment>,
  <Fragment key="website-meeting-01">{scene02Meeting}</Fragment>,
  <Fragment key="website-diagram-simple">{scene01SimpleDiagram}</Fragment>,
  <Fragment key="website-arch-overview">{scene02ArchOverview}</Fragment>,
  <Fragment key="website-arch-detail">{scene03ArchDetail}</Fragment>,
  <Fragment key="website-full-02">{scene02Combined}</Fragment>,
  <Fragment key="website-github-01">{scene01Github}</Fragment>,
];

export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'BrewSite',       sceneId: 'website-hero-00' },
  { num: '01', label: 'The Engine',     sceneId: 'website-presentation-01' },
  { num: '02', label: 'How It Works',   sceneId: 'website-presentation-02' },
  { num: '03', label: 'Models',         sceneId: 'website-model-01' },
  { num: '04', label: 'At Scale',       sceneId: 'website-meeting-01' },
  { num: '05', label: 'Diagrams',       sceneId: 'website-diagram-simple' },
  { num: '06', label: 'Architecture',   sceneId: 'website-arch-overview' },
  { num: '07', label: 'Drill-Down',     sceneId: 'website-arch-detail' },
  { num: '08', label: 'Full Stack',     sceneId: 'website-full-02' },
  { num: '09', label: 'Get Started',    sceneId: 'website-github-01' },
];
