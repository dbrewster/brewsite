import { JSX, useEffect } from 'react';
import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';
import type { WidgetRegistry } from '@brewsite/core';
import { DocsSidebar } from './DocsSidebar';
import { SCENE_SCROLL_OFFSETS } from '../../nav/docs-nav';
import * as Scenes from '../../scenes/index';

// Module-level stable widget setup.
// MUST be module-level — if recreated on every render, ScenePlayer would
// rebuild the entire Three.js driver, causing constant flicker.
const widgetSetup = (_manifest: unknown): WidgetRegistry =>
  createDefaultWidgetRegistry(_manifest);

/**
 * DocsApp — root component for the BrewSite continuous-scroll documentation.
 *
 * Architecture:
 * - DocsSidebar lives OUTSIDE ScenePlayer and reads engine state via the global
 *   registry (useSceneEngineState). No ancestor EngineProvider is needed.
 * - ScenePlayer drives all 34 scenes via scroll. pixelsPerScene={1} makes each
 *   scene's scrollUnits equal to exact pixel scroll distance.
 * - URL hash is updated on scene change for deep-link support.
 */
export function DocsApp(): JSX.Element {
  // Handle deep-link hash on initial load.
  // A short delay lets ScenePlayer finish its initial layout before we scroll.
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar: uses useSceneEngineState('docs') — works outside ScenePlayer */}
      <DocsSidebar />

      {/* ScenePlayer fills remaining horizontal space */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <ScenePlayer
          id="docs"
          manifestUrl="/scene-manifest.json"
          widgetSetup={widgetSetup}
          quality="balanced"
          pixelsPerScene={1}
          onSceneChange={(sceneId) => {
            history.replaceState(null, '', `#${sceneId}`);
          }}
          onError={(err) => console.error('[BrewSite docs]', err)}
        >
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
        </ScenePlayer>
      </div>
    </div>
  );
}
