import type {JSX} from 'react';
import {useMemo} from 'react';
import {
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import {createComparisonPlugins} from './widgetSetup';
import {sceneHero} from './scenes/scene_hero';
import {sceneCfOverview} from './scenes/scene_cf_overview';
import {sceneBfOverview} from './scenes/scene_bf_overview';
import {sceneDim1Audit} from './scenes/scene_dim1_audit';
import {sceneDim2Learning} from './scenes/scene_dim2_learning';
import {sceneDim3Context} from './scenes/scene_dim3_context';
import {sceneDim4Coordination} from './scenes/scene_dim4_coordination';
import {sceneDim5Restart} from './scenes/scene_dim5_restart';
import {sceneDim6Gating} from './scenes/scene_dim6_gating';
import {sceneDim7Safety} from './scenes/scene_dim7_safety';
import {sceneDim8Maturity} from './scenes/scene_dim8_maturity';
import {sceneSummary} from './scenes/scene_summary';

const SCENE_SCROLL_REGISTRY = [
  { sceneId: 'bfc-hero',         scrollUnits: 800  },
  { sceneId: 'bfc-cf-overview',  scrollUnits: 2600 },
  { sceneId: 'bfc-bf-overview',  scrollUnits: 2600 },
  { sceneId: 'bfc-dim1-audit',   scrollUnits: 2800 },
  { sceneId: 'bfc-dim2-learn',   scrollUnits: 3000 },
  { sceneId: 'bfc-dim3-context', scrollUnits: 2800 },
  { sceneId: 'bfc-dim4-coord',   scrollUnits: 2600 },
  { sceneId: 'bfc-dim5-restart', scrollUnits: 2800 },
  { sceneId: 'bfc-dim6-gate',    scrollUnits: 2400 },
  { sceneId: 'bfc-dim7-safety',  scrollUnits: 2400 },
  { sceneId: 'bfc-dim8-mature',  scrollUnits: 2600 },
  { sceneId: 'bfc-summary',      scrollUnits: 1600 },
] as const;

const TOTAL_SCROLL_HEIGHT = SCENE_SCROLL_REGISTRY.reduce((s, r) => s + r.scrollUnits, 0);

export default function ComparisonPage(): JSX.Element {
  const { plugins } = useMemo(() => createComparisonPlugins(), []);

  return (
    <div style={{ background: '#080b14', height: '100vh', overflow: 'hidden', fontSize: '18px' }}>
      <SceneEngine plugins={plugins}>
        {sceneHero}
        {sceneCfOverview}
        {sceneBfOverview}
        {sceneDim1Audit}
        {sceneDim2Learning}
        {sceneDim3Context}
        {sceneDim4Coordination}
        {sceneDim5Restart}
        {sceneDim6Gating}
        {sceneDim7Safety}
        {sceneDim8Maturity}
        {sceneSummary}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <KeyboardInput />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
