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

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteFlowScenes: JSX.Element[] = [
  <Fragment key="website-hero-00">{scene00Hero}</Fragment>,
  <Fragment key="website-presentation-01">{scene01CoreIntro}</Fragment>,
  <Fragment key="website-presentation-02">{scene02CoreBaked}</Fragment>,
  <Fragment key="website-diagram-simple">{scene01SimpleDiagram}</Fragment>,
  <Fragment key="website-arch-overview">{scene02ArchOverview}</Fragment>,
  <Fragment key="website-arch-detail">{scene03ArchDetail}</Fragment>,
  <Fragment key="website-model-01">{scene01ModelWide}</Fragment>,
  <Fragment key="website-meeting-01">{scene02Meeting}</Fragment>,
];

export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'Hero',            sceneId: 'website-hero-00' },
  { num: '01', label: 'Presentation I',  sceneId: 'website-presentation-01' },
  { num: '02', label: 'Presentation II', sceneId: 'website-presentation-02' },
  { num: '03', label: 'Docs Story',      sceneId: 'website-diagram-simple' },
  { num: '04', label: 'Architecture',    sceneId: 'website-arch-overview' },
  { num: '05', label: 'Drill-Down',      sceneId: 'website-arch-detail' },
  { num: '06', label: 'Models',          sceneId: 'website-model-01' },
  { num: '07', label: 'Meeting',         sceneId: 'website-meeting-01' },
];
