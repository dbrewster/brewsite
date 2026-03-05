import type {JSX} from 'react';
import {useMemo} from 'react';
import {EngineARContainer, EngineInputRegion, EngineOverlayHost, EngineProvider, SceneCanvas,} from '@brewsite/core';
import {createMultiUserPlugins} from './widgetSetup';
import {sceneHero} from './scenes/scene_hero';
import {sceneProblems} from './scenes/scene_problems';
import {sceneSessionHierarchy} from './scenes/scene_session_hierarchy';
import {sceneEpisodicPartition} from './scenes/scene_episodic_partition';
import {sceneNeocortexScopes} from './scenes/scene_neocortex_scopes';
import {sceneDreamingCloud} from './scenes/scene_dreaming_cloud';
import {sceneExpertRoles} from './scenes/scene_expert_roles';
import {sceneDebateRounds} from './scenes/scene_debate_rounds';
import {sceneConvergence} from './scenes/scene_convergence';
import {sceneFractal} from './scenes/scene_fractal';
import {sceneCrossUserFlow} from './scenes/scene_crossuser_flow';
import {sceneConflict} from './scenes/scene_conflict';
import {sceneSummary} from './scenes/scene_summary';

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
  const { plugins } = useMemo(() => createMultiUserPlugins(), []);

  return (
    <div style={{ background: '#080b14', minHeight: '100vh', fontSize: '18px' }}>
      <EngineProvider
        manifestUrl="/scene-manifest.json"
        plugins={plugins}
        pixelsPerScene={TOTAL_SCROLL_HEIGHT / SCENE_SCROLL_REGISTRY.length}
        inputModePolicy="prefer-scroll"
      >
        {sceneHero}
        {sceneProblems}
        {sceneSessionHierarchy}
        {sceneEpisodicPartition}
        {sceneNeocortexScopes}
        {sceneDreamingCloud}
        {sceneExpertRoles}
        {sceneDebateRounds}
        {sceneConvergence}
        {sceneFractal}
        {sceneCrossUserFlow}
        {sceneConflict}
        {sceneSummary}
        <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
          <EngineInputRegion>
            <SceneCanvas />
            <EngineOverlayHost />
          </EngineInputRegion>
        </EngineARContainer>
      </EngineProvider>
    </div>
  );
}
