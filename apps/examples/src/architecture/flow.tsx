import type {JSX} from 'react';
import {Fragment} from 'react';
import {sceneCoreAngledArch, sceneCoreArch} from './scenes/scene_core';
import {sceneDiagramAngledArch, sceneDiagramArch} from './scenes/scene_diagram';
import {sceneModelAngledArch, sceneModelArch} from './scenes/scene_model';
import {sceneChartsAngledArch, sceneChartsArch} from './scenes/scene_charts';

export const architectureFlowScenes: JSX.Element[] = [
  <Fragment key="arch-core-angled">{sceneCoreAngledArch}</Fragment>,
  <Fragment key="arch-core">{sceneCoreArch}</Fragment>,
  <Fragment key="arch-diagram-angled">{sceneDiagramAngledArch}</Fragment>,
  <Fragment key="arch-diagram">{sceneDiagramArch}</Fragment>,
  <Fragment key="arch-model-angled">{sceneModelAngledArch}</Fragment>,
  <Fragment key="arch-model">{sceneModelArch}</Fragment>,
  <Fragment key="arch-charts-angled">{sceneChartsAngledArch}</Fragment>,
  <Fragment key="arch-charts">{sceneChartsArch}</Fragment>,
];
