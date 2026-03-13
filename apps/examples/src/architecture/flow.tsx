import type {JSX} from 'react';
import {SceneCoreAngledArch, SceneCoreArch} from './scenes/scene_core';
import {SceneDiagramAngledArch, SceneDiagramArch} from './scenes/scene_diagram';
import {SceneModelAngledArch, SceneModelArch} from './scenes/scene_model';
import {SceneChartsAngledArch, SceneChartsArch} from './scenes/scene_charts';

export const architectureFlowScenes: JSX.Element[] = [
  <SceneCoreAngledArch key="arch-core-angled" />,
  <SceneCoreArch key="arch-core" />,
  <SceneDiagramAngledArch key="arch-diagram-angled" />,
  <SceneDiagramArch key="arch-diagram" />,
  <SceneModelAngledArch key="arch-model-angled" />,
  <SceneModelArch key="arch-model" />,
  <SceneChartsAngledArch key="arch-charts-angled" />,
  <SceneChartsArch key="arch-charts" />,
];
