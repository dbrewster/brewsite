import type {JSX} from 'react';
import {useMemo} from 'react';
import {
  InputCoordinator,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import {createSidecarPlugins} from './widgetSetup';
import {SceneHero} from './scenes/scene_hero';
import {SceneSurfaces} from './scenes/scene_surfaces';
import {SceneArchitecture} from './scenes/scene_architecture';
import {SceneBridge} from './scenes/scene_bridge';
import {SceneMcp} from './scenes/scene_mcp';
import {SceneHooks} from './scenes/scene_hooks';
import {SceneSequenceNormal} from './scenes/scene_sequence_normal';
import {SceneSequenceFailure} from './scenes/scene_sequence_failure';
import {SceneDreamer} from './scenes/scene_dreamer';
import {SceneDeploymentLevels} from './scenes/scene_deployment_levels';
import {SceneTradeoffs} from './scenes/scene_tradeoffs';

const SCENE_SCROLL_REGISTRY = [
  { sceneId: 'bf-hero',         scrollUnits: 800  },
  { sceneId: 'bf-surfaces',     scrollUnits: 3200 },
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
  const { plugins, theme } = useMemo(() => createSidecarPlugins(), []);

  return (
    <div style={{ background: '#080b14', height: '100vh', overflow: 'hidden', fontSize: '18px' }}>
      <SceneEngine plugins={plugins} theme={theme}>
        <SceneHero />
        <SceneSurfaces />
        <SceneArchitecture />
        <SceneBridge />
        <SceneMcp />
        <SceneHooks />
        <SceneSequenceNormal />
        <SceneSequenceFailure />
        <SceneDreamer />
        <SceneDeploymentLevels />
        <SceneTradeoffs />
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <InputCoordinator />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
