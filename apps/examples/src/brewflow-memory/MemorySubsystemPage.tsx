import type {JSX} from 'react';
import {useMemo} from 'react';
import {
  ActionInput,
  BackgroundLayer,
  EngineARContainer,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import {createMemoryPlugins} from './widgetSetup';
import {SceneHero} from './scenes/scene_hero';
import {SceneClsTheory} from './scenes/scene_cls_theory';
import {SceneEpisodicStore} from './scenes/scene_episodic_store';
import {SceneSomniocortex} from './scenes/scene_somniocortex';
import {SceneNeocortex} from './scenes/scene_neocortex';
import {SceneInjector} from './scenes/scene_injector';
import {SceneLearningLoop} from './scenes/scene_learning_loop';
import {SceneSensitiveDataGuard} from './scenes/scene_sensitive_data_guard';
import {SceneSummary} from './scenes/scene_summary';

const SCENE_SCROLL_REGISTRY = [
  { sceneId: 'bfm-hero',         scrollUnits: 800  },
  { sceneId: 'bfm-cls',          scrollUnits: 2600 },
  { sceneId: 'bfm-episodic',     scrollUnits: 3000 },
  { sceneId: 'bfm-somniocortex', scrollUnits: 3200 },
  { sceneId: 'bfm-neocortex',    scrollUnits: 3200 },
  { sceneId: 'bfm-injector',     scrollUnits: 2800 },
  { sceneId: 'bfm-loop',         scrollUnits: 2600 },
  { sceneId: 'bfm-guard',        scrollUnits: 2000 },
  { sceneId: 'bfm-summary',      scrollUnits: 1600 },
] as const;

const TOTAL_SCROLL_HEIGHT = SCENE_SCROLL_REGISTRY.reduce((s, r) => s + r.scrollUnits, 0);

export default function MemorySubsystemPage(): JSX.Element {
  const { plugins } = useMemo(() => createMemoryPlugins(), []);

  return (
    <div style={{ background: '#080b14', height: '100vh', overflow: 'hidden', fontSize: '20px' }}>
      <SceneEngine plugins={plugins}>
        <SceneHero/>
        <SceneClsTheory/>
        <SceneEpisodicStore/>
        <SceneSomniocortex/>
        <SceneNeocortex/>
        <SceneInjector/>
        <SceneLearningLoop/>
        <SceneSensitiveDataGuard/>
        <SceneSummary/>
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <ActionInput />
          <KeyboardInput />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
