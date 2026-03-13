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
import {createMultiUserPlugins} from './widgetSetup';
import {SceneHero} from './scenes/scene_hero';
import {SceneProblems} from './scenes/scene_problems';
import {SceneSessionHierarchy} from './scenes/scene_session_hierarchy';
import {SceneEpisodicPartition} from './scenes/scene_episodic_partition';
import {SceneNeocortexScopes} from './scenes/scene_neocortex_scopes';
import {SceneDreamingCloud} from './scenes/scene_dreaming_cloud';
import {SceneExpertRoles} from './scenes/scene_expert_roles';
import {SceneDebateRounds} from './scenes/scene_debate_rounds';
import {SceneConvergence} from './scenes/scene_convergence';
import {SceneFractal} from './scenes/scene_fractal';
import {SceneCrossUserFlow} from './scenes/scene_crossuser_flow';
import {SceneConflict} from './scenes/scene_conflict';
import {SceneSummary} from './scenes/scene_summary';

const SCENE_SCROLL_REGISTRY = [
  { sceneId: 'bfmu-hero',         scrollUnits: 800  },
  { sceneId: 'bfmu-problems',     scrollUnits: 2400 },
  { sceneId: 'bfmu-sessions',     scrollUnits: 2600 },
  { sceneId: 'bfmu-episodic',     scrollUnits: 2800 },
  { sceneId: 'bfmu-neocortex',    scrollUnits: 2800 },
  { sceneId: 'bfmu-dreaming',     scrollUnits: 3000 },
  { sceneId: 'bfmu-experts',      scrollUnits: 2800 },
  { sceneId: 'bfmu-debate',       scrollUnits: 3000 },
  { sceneId: 'bfmu-convergence',  scrollUnits: 2400 },
  { sceneId: 'bfmu-fractal',      scrollUnits: 2600 },
  { sceneId: 'bfmu-crossuser',    scrollUnits: 3000 },
  { sceneId: 'bfmu-conflict',     scrollUnits: 2400 },
  { sceneId: 'bfmu-summary',      scrollUnits: 1600 },
] as const;

const TOTAL_SCROLL_HEIGHT = SCENE_SCROLL_REGISTRY.reduce((s, r) => s + r.scrollUnits, 0);

export default function MultiUserPage(): JSX.Element {
  const { plugins, theme } = useMemo(() => createMultiUserPlugins(), []);

  return (
    <div style={{ background: '#080b14', width: '100vw', height: '100vh', overflow: 'hidden', minWidth: '100vw', fontSize: '18px' }}>
      <SceneEngine plugins={plugins} theme={theme}>
        <SceneHero />
        <SceneProblems />
        {/*<SceneSessionHierarchy />*/}
        {/*<SceneEpisodicPartition />*/}
        {/*<SceneNeocortexScopes />*/}
        {/*<SceneDreamingCloud />*/}
        {/*<SceneExpertRoles />*/}
        {/*<SceneDebateRounds />*/}
        {/*<SceneConvergence />*/}
        {/*<SceneFractal />*/}
        {/*<SceneCrossUserFlow />*/}
        {/*<SceneConflict />*/}
        {/*<SceneSummary />*/}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}>
          <EngineARContainer aspectRatio={9/9} scaleMode="fit-height" referenceWidth={1920}>
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
