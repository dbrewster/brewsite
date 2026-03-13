import type {JSX} from 'react';
import {useMemo} from 'react';
import {BackgroundLayer, EngineARContainer, EngineOverlayHost, InputCoordinator, SceneCanvas, SceneEngine, ScrollStage,} from '@brewsite/core';
import {createComparisonPlugins} from './widgetSetup';
import {SceneHero} from './scenes/scene_hero';
import {SceneBfOverview} from './scenes/scene_bf_overview';
import {SceneDim1Audit} from './scenes/scene_dim1_audit';
import {SceneDim2Learning} from './scenes/scene_dim2_learning';
import {SceneDim3Context} from './scenes/scene_dim3_context';
import {SceneDim4Coordination} from './scenes/scene_dim4_coordination';
import {SceneDim5Restart} from './scenes/scene_dim5_restart';
import {SceneDim6Gating} from './scenes/scene_dim6_gating';
import {SceneDim7Safety} from './scenes/scene_dim7_safety';
import {SceneDim8Maturity} from './scenes/scene_dim8_maturity';
import {SceneSummary} from './scenes/scene_summary';
import {SceneCfOverview} from "./scenes/scene_cf_overview";

const SCENE_SCROLL_REGISTRY = [
  {sceneId: 'bfc-hero', scrollUnits: 800},
  {sceneId: 'bfc-cf-overview', scrollUnits: 2600},
  {sceneId: 'bfc-bf-overview', scrollUnits: 2600},
  {sceneId: 'bfc-dim1-audit', scrollUnits: 2800},
  {sceneId: 'bfc-dim2-learn', scrollUnits: 3000},
  {sceneId: 'bfc-dim3-context', scrollUnits: 2800},
  {sceneId: 'bfc-dim4-coord', scrollUnits: 2600},
  {sceneId: 'bfc-dim5-restart', scrollUnits: 2800},
  {sceneId: 'bfc-dim6-gate', scrollUnits: 2400},
  {sceneId: 'bfc-dim7-safety', scrollUnits: 2400},
  {sceneId: 'bfc-dim8-mature', scrollUnits: 2600},
  {sceneId: 'bfc-summary', scrollUnits: 1600},
] as const;

const TOTAL_SCROLL_HEIGHT = SCENE_SCROLL_REGISTRY.reduce((s, r) => s + r.scrollUnits, 0);

export default function ComparisonPage(): JSX.Element {
  const { plugins, theme } = useMemo(() => createComparisonPlugins(), []);

  return (
    <div style={{background: '#080b14', height: '100vh', overflow: 'hidden', fontSize: '18px'}}>
      <SceneEngine plugins={plugins} theme={theme}>
        <SceneHero/>
        <SceneCfOverview/>
        <SceneBfOverview/>
        <SceneDim1Audit/>
        <SceneDim2Learning/>
        <SceneDim3Context/>
        <SceneDim4Coordination/>
        <SceneDim5Restart/>
        <SceneDim6Gating/>
        <SceneDim7Safety/>
        <SceneDim8Maturity/>
        <SceneSummary/>
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{position: 'absolute', inset: 0, zIndex: 0}}/>
            <SceneCanvas style={{position: 'absolute', inset: 0, zIndex: 1}}/>
            <EngineOverlayHost/>
          </EngineARContainer>
          <InputCoordinator/>
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
