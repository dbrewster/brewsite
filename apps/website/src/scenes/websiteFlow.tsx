import { Fragment } from 'react';
import type { JSX } from 'react';
import { scene00Hero } from './act0/scene_00_hero';
import { scene01CoreIntro } from './act1_act2/scene_01_core_intro';
import { scene02CoreBaked } from './act1_act2/scene_02_core_baked';
import { scene03HudIsReact } from './act1_act2/scene_03_hud_is_react';
import { scene04Transitions } from './act1_act2/scene_04_transitions';
import { scene01ModelWide } from './act3/scene_01_model_wide';
import { scene02ModelClose } from './act3/scene_02_model_close';
import { scene01Meeting } from './act4/scene_01_meeting';
import { scene01SimpleDiagram } from './act5_act6/scene_01_simple_diagram';
import { scene02ArchOverview } from './act5_act6/scene_02_arch_overview';
import { scene03ArchDetail } from './act5_act6/scene_03_arch_detail';
import { scene01Foundation } from './act7/scene_01_foundation';
import { scene02Combined } from './act7/scene_02_combined';
import { scene01Github } from './act8/scene_01_github';

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteFlowScenes: JSX.Element[] = [
  <Fragment key="website-hero-00">{scene00Hero}</Fragment>,
  <Fragment key="website-core-01">{scene01CoreIntro}</Fragment>,
  <Fragment key="website-core-02">{scene02CoreBaked}</Fragment>,
  <Fragment key="website-libraries-01">{scene03HudIsReact}</Fragment>,
  <Fragment key="website-libraries-02">{scene04Transitions}</Fragment>,
  <Fragment key="website-model-01">{scene01ModelWide}</Fragment>,
  <Fragment key="website-model-02">{scene02ModelClose}</Fragment>,
  <Fragment key="website-meeting-01">{scene01Meeting}</Fragment>,
  <Fragment key="website-diagram-simple">{scene01SimpleDiagram}</Fragment>,
  <Fragment key="website-arch-overview">{scene02ArchOverview}</Fragment>,
  <Fragment key="website-arch-detail">{scene03ArchDetail}</Fragment>,
  <Fragment key="website-full-01">{scene01Foundation}</Fragment>,
  <Fragment key="website-full-02">{scene02Combined}</Fragment>,
  <Fragment key="website-github-01">{scene01Github}</Fragment>,
];

export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'Hero', sceneId: 'website-hero-00' },
  { num: '01', label: 'The Core', sceneId: 'website-core-01' },
  { num: '02', label: 'Libraries', sceneId: 'website-libraries-01' },
  { num: '03', label: 'Models', sceneId: 'website-model-01' },
  { num: '04', label: 'The Meeting', sceneId: 'website-meeting-01' },
  { num: '05', label: 'Diagrams', sceneId: 'website-diagram-simple' },
  { num: '06', label: 'Architecture', sceneId: 'website-arch-overview' },
  { num: '07', label: 'Full Stack', sceneId: 'website-full-01' },
  { num: '08', label: 'GitHub', sceneId: 'website-github-01' },
];
