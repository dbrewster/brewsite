import type {JSX} from 'react';
import {useMemo} from 'react';
import {EngineInputRegion, EngineOverlayHost, EngineProvider, SceneCanvas,} from '@brewsite/core';
import {createSidecarPlugins} from './widgetSetup';
import {sceneHero} from './scenes/scene_hero';
import {sceneSurfaces} from './scenes/scene_surfaces';
import {sceneArchitecture} from './scenes/scene_architecture';
import {sceneBridge} from './scenes/scene_bridge';
import {sceneMcp} from './scenes/scene_mcp';
import {sceneHooks} from './scenes/scene_hooks';
import {sceneSequenceNormal} from './scenes/scene_sequence_normal';
import {sceneSequenceFailure} from './scenes/scene_sequence_failure';
import {sceneDreamer} from './scenes/scene_dreamer';
import {sceneDeploymentLevels} from './scenes/scene_deployment_levels';
import {sceneTradeoffs} from './scenes/scene_tradeoffs';

const SCENE_SCROLL_REGISTRY = [
  { sceneId: 'bf-hero',         scrollUnits: 800  },
  { sceneId: 'bf-surfaces',     scrollUnits: 2800 },
  { sceneId: 'bf-architecture', scrollUnits: 3200 },
  { sceneId: 'bf-bridge',       scrollUnits: 2400 },
  { sceneId: 'bf-mcp',          scrollUnits: 3200 },
  { sceneId: 'bf-hooks',        scrollUnits: 2000 },
  { sceneId: 'bf-seq-normal',   scrollUnits: 2800 },
  { sceneId: 'bf-seq-failure',  scrollUnits: 2400 },
  { sceneId: 'bf-dreamer',      scrollUnits: 2800 },
  { sceneId: 'bf-levels',       scrollUnits: 3000 },
  { sceneId: 'bf-tradeoffs',    scrollUnits: 1600 },
] as const;

const TOTAL_SCROLL_HEIGHT = SCENE_SCROLL_REGISTRY.reduce((s, r) => s + r.scrollUnits, 0);

export default function SidecarNotePage(): JSX.Element {
  const { plugins } = useMemo(() => createSidecarPlugins(), []);

  return (
    <div style={{ background: '#080b14', minHeight: '100vh', fontSize: '18px' }}>
      <EngineProvider
        manifestUrl="/scene-manifest.json"
        plugins={plugins}
        pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}
        inputModePolicy="prefer-scroll"
      >
        {sceneHero}
        {sceneSurfaces}
        {sceneArchitecture}
        {sceneBridge}
        {sceneMcp}
        {sceneHooks}
        {sceneSequenceNormal}
        {sceneSequenceFailure}
        {sceneDreamer}
        {sceneDeploymentLevels}
        {sceneTradeoffs}
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
