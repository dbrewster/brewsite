import { Fragment } from 'react';
import type { JSX } from 'react';
import { sceneCoreArch } from './scenes/scene_core';
import { sceneDiagramArch } from './scenes/scene_diagram';
import { sceneModelArch } from './scenes/scene_model';
import { sceneChartsArch } from './scenes/scene_charts';

export const architectureFlowScenes: JSX.Element[] = [
  <Fragment key="arch-core">{sceneCoreArch}</Fragment>,
  <Fragment key="arch-diagram">{sceneDiagramArch}</Fragment>,
  <Fragment key="arch-model">{sceneModelArch}</Fragment>,
  <Fragment key="arch-charts">{sceneChartsArch}</Fragment>,
];
