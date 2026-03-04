import type {JSX} from 'react';
import {useMemo} from 'react';
import {EngineInputRegion, EngineOverlayHost, EngineProvider, SceneCanvas,} from '@brewsite/core';
import {createMemoryPlugins} from './widgetSetup';
import {sceneHero} from './scenes/scene_hero';
import {sceneClsTheory} from './scenes/scene_cls_theory';
import {sceneEpisodicStore} from './scenes/scene_episodic_store';
import {sceneSomniocortex} from './scenes/scene_somniocortex';
import {sceneNeocortex} from './scenes/scene_neocortex';
import {sceneInjector} from './scenes/scene_injector';
import {sceneLearningLoop} from './scenes/scene_learning_loop';
import {sceneSensitiveDataGuard} from './scenes/scene_sensitive_data_guard';
import {sceneSummary} from './scenes/scene_summary';

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
    <div style={{ background: '#080b14', minHeight: '100vh', fontSize: '20px' }}>
      <EngineProvider
        manifestUrl="/scene-manifest.json"
        plugins={plugins}
        pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}
        inputModePolicy="prefer-scroll"
      >
        {sceneHero}
        {sceneClsTheory}
        {sceneEpisodicStore}
        {sceneSomniocortex}
        {sceneNeocortex}
        {sceneInjector}
        {sceneLearningLoop}
        {sceneSensitiveDataGuard}
        {sceneSummary}
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
