import { JSX, useCallback, useEffect, useMemo } from 'react';
import {
  corePlugin,
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
  EngineOverlayHost,
} from '@brewsite/core';
import { DocsSidebar } from './DocsSidebar';
import { SCENE_SCROLL_OFFSETS, TOTAL_SCROLL_HEIGHT } from '../../nav/docs-nav';
import * as Scenes from '../../scenes/index';

/**
 * DocsLayout — renders the two-column docs UI inside EngineProvider context.
 *
 * Must be a child of EngineProvider so useSceneEngineContext() resolves.
 * The sidebar and canvas are siblings here, both inside the engine tree.
 * EngineInputRegion reads engine state from context — no engine prop needed.
 */
const DocsLayout = (): JSX.Element => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar: sits inside EngineProvider — can use context hooks directly */}
      <DocsSidebar />

      {/* Canvas column fills remaining horizontal space */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <EngineInputRegion>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
          <EngineOverlayHost passthroughPointerEvents={false} />
        </EngineInputRegion>
      </div>
    </div>
  );
};

/**
 * DocsApp — root component for the BrewSite continuous-scroll documentation.
 *
 * Architecture:
 * - EngineProvider wraps BOTH the sidebar and the canvas region, so all
 *   engine context is available to the entire docs UI.
 * - DocsLayout (child of EngineProvider) reads engine state via
 *   useSceneEngineContext() and composes the two-column layout.
 * - DocsSidebar uses useSceneEngineState('docs') for active-scene tracking.
 * - scrollHeightPx={TOTAL_SCROLL_HEIGHT} sets the scroll region to exactly the sum
 *   of all scene scrollUnits, so SCENE_SCROLL_OFFSETS (cumulative scrollUnits) map
 *   directly to pixel scroll positions and sidebar navigation is accurate.
 * - URL hash is updated on scene change for deep-link support.
 */
export function DocsApp(): JSX.Element {
  // Handle deep-link hash on initial load.
  // A short delay lets the engine finish its initial layout before we scroll.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const offset = hash ? SCENE_SCROLL_OFFSETS[hash] : undefined;
    if (offset !== undefined) {
      const timer = setTimeout(() => {
        window.scrollTo({ top: offset, behavior: 'instant' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // onSceneChange must be stable — wrap in useCallback so plugins reference
  // doesn't change on every render and trigger registry rebuilds.
  const handleSceneChange = useCallback((sceneId: string) => {
    history.replaceState(null, '', `#${sceneId}`);
  }, []);

  // Module-level stable plugin list would be ideal, but onSceneChange depends
  // on a stable callback, so useMemo with [handleSceneChange] is the right pattern.
  const plugins = useMemo(
    () => [corePlugin({ onSceneChange: handleSceneChange })],
    [handleSceneChange],
  );

  return (
    <EngineProvider
      id="docs"
      manifestUrl="/scene-manifest.json"
      plugins={plugins}
      quality="balanced"
      scrollHeightPx={TOTAL_SCROLL_HEIGHT}
      onError={(err) => console.error('[BrewSite docs]', err)}
    >
      {/* ── Scene declarations ─────────────────────────────────────────────────
          These render null — they register their getFrame() with
          SceneRegistrationContext so the engine can compile the track.      */}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Scenes.ActHeroScene />

      {/* ── Act 1: Getting Started ────────────────────────────────────────── */}
      <Scenes.ActGettingStartedScene />
      <Scenes.SceneWhatIsBrewSite />
      <Scenes.SceneInstallation />
      <Scenes.SceneQuickStart />
      <Scenes.SceneConcepts />

      {/* ── Act 2: Scene Authoring ────────────────────────────────────────── */}
      <Scenes.ActSceneAuthoringScene />
      <Scenes.SceneSceneDsl />
      <Scenes.SceneMultiScene />
      <Scenes.SceneTransitions />
      <Scenes.SceneProgressManager />

      {/* ── Act 3: Elements ───────────────────────────────────────────────── */}
      <Scenes.ActElementsScene />
      <Scenes.SceneCamera />
      <Scenes.SceneLighting />
      <Scenes.SceneBackground />
      <Scenes.SceneEnvironment />
      <Scenes.SceneFloor />

      {/* ── Act 4: Overlay Content ────────────────────────────────────────── */}
      <Scenes.ActOverlayContentScene />
      <Scenes.SceneHud />
      <Scenes.SceneHudAnimejs />

      {/* ── Act 5: Input ──────────────────────────────────────────────────── */}
      <Scenes.ActInputScene />
      <Scenes.SceneInputNavigation />
      <Scenes.SceneInputActions />

      {/* ── Act 6: Player & Hooks ─────────────────────────────────────────── */}
      <Scenes.ActPlayerHooksScene />
      <Scenes.ScenePlayerDocs />
      <Scenes.SceneHooksDocs />

      {/* ── Act 7: Widget SDK ─────────────────────────────────────────────── */}
      <Scenes.ActWidgetSdkScene />
      <Scenes.SceneWidgetSdk />
      <Scenes.SceneCustomWidget />
      <Scenes.SceneVariableStore />
      <Scenes.SceneWidgetRegistry />

      {/* ── Act 8: Reference ──────────────────────────────────────────────── */}
      <Scenes.ActReferenceScene />
      <Scenes.SceneApiReference />
      <Scenes.SceneTimelineDocs />

      {/* ── Layout: sidebar + canvas, both inside the engine context tree ── */}
      <DocsLayout />
    </EngineProvider>
  );
}
