import type { NavSection } from './types';

// ── Scroll budget registry ──────────────────────────────────────────────────
// Each entry maps a sceneId to its scrollUnits budget.
// pixelsPerScene={1} on ScenePlayer means scrollUnits === pixels of scroll.
// The last scene's scrollUnits value is ignored by the engine (no outgoing
// transition), but we keep it here so SCENE_SCROLL_OFFSETS stays aligned.

export const SCENE_SCROLL_REGISTRY = [
  // ── Hero ──
  { sceneId: 'docs-hero',                 scrollUnits: 1200 },

  // ── Act 1: Getting Started ──
  { sceneId: 'act-getting-started',       scrollUnits: 600  },
  { sceneId: 'scene-what-is-brewsite',    scrollUnits: 2400 },
  { sceneId: 'scene-installation',        scrollUnits: 1600 },
  { sceneId: 'scene-quick-start',         scrollUnits: 3200 },
  { sceneId: 'scene-concepts',            scrollUnits: 2400 },

  // ── Act 2: Scene Authoring ──
  { sceneId: 'act-scene-authoring',       scrollUnits: 600  },
  { sceneId: 'scene-scene-dsl',           scrollUnits: 3200 },
  { sceneId: 'scene-multi-scene',         scrollUnits: 3200 },
  { sceneId: 'scene-transitions',         scrollUnits: 3200 },
  { sceneId: 'scene-progress-manager',    scrollUnits: 2400 },

  // ── Act 3: Elements ──
  { sceneId: 'act-elements',              scrollUnits: 600  },
  { sceneId: 'scene-camera',              scrollUnits: 3200 },
  { sceneId: 'scene-lighting',            scrollUnits: 3200 },
  { sceneId: 'scene-background',          scrollUnits: 2400 },
  { sceneId: 'scene-environment',         scrollUnits: 2400 },
  { sceneId: 'scene-floor',               scrollUnits: 2400 },

  // ── Act 4: Overlay Content ──
  { sceneId: 'act-overlay-content',       scrollUnits: 600  },
  { sceneId: 'scene-hud',                 scrollUnits: 3200 },
  { sceneId: 'scene-hud-animejs',         scrollUnits: 2400 },

  // ── Act 5: Input ──
  { sceneId: 'act-input',                 scrollUnits: 600  },
  { sceneId: 'scene-input-navigation',    scrollUnits: 2400 },
  { sceneId: 'scene-input-actions',       scrollUnits: 3200 },

  // ── Act 6: Player & Hooks ──
  { sceneId: 'act-player-hooks',          scrollUnits: 600  },
  { sceneId: 'scene-player',              scrollUnits: 2400 },
  { sceneId: 'scene-hooks',               scrollUnits: 3200 },

  // ── Act 7: Widget SDK ──
  { sceneId: 'act-widget-sdk',            scrollUnits: 600  },
  { sceneId: 'scene-widget-sdk',          scrollUnits: 2400 },
  { sceneId: 'scene-custom-widget',       scrollUnits: 2400 },
  { sceneId: 'scene-variable-store',      scrollUnits: 3200 },
  { sceneId: 'scene-widget-registry',     scrollUnits: 2400 },

  // ── Act 8: Reference ──
  { sceneId: 'act-reference',             scrollUnits: 600  },
  { sceneId: 'scene-api-reference',       scrollUnits: 2400 },
  { sceneId: 'scene-timeline',            scrollUnits: 2400 },
] as const;

export const TOTAL_SCROLL_HEIGHT: number =
  SCENE_SCROLL_REGISTRY.reduce((sum, s) => sum + s.scrollUnits, 0);

/** Map from sceneId → scroll offset in pixels from window top.
 *  Use with: window.scrollTo({ top: SCENE_SCROLL_OFFSETS[sceneId] }) */
export const SCENE_SCROLL_OFFSETS: Readonly<Record<string, number>> = (() => {
  const offsets: Record<string, number> = {};
  let cursor = 0;
  for (const { sceneId, scrollUnits } of SCENE_SCROLL_REGISTRY) {
    offsets[sceneId] = cursor;
    cursor += scrollUnits;
  }
  return offsets;
})();

// ── Sidebar navigation ──────────────────────────────────────────────────────

export const docsNav: NavSection[] = [
  {
    title: 'Getting Started',
    actSceneId: 'act-getting-started',
    items: [
      { label: 'What is BrewSite Core?', sceneId: 'scene-what-is-brewsite',  scrollOffset: SCENE_SCROLL_OFFSETS['scene-what-is-brewsite'] },
      { label: 'Installation',           sceneId: 'scene-installation',       scrollOffset: SCENE_SCROLL_OFFSETS['scene-installation'] },
      { label: 'Quick Start',            sceneId: 'scene-quick-start',        scrollOffset: SCENE_SCROLL_OFFSETS['scene-quick-start'] },
      { label: 'Core Concepts',          sceneId: 'scene-concepts',           scrollOffset: SCENE_SCROLL_OFFSETS['scene-concepts'] },
    ],
  },
  {
    title: 'Scene Authoring',
    actSceneId: 'act-scene-authoring',
    items: [
      { label: 'Scene DSL',              sceneId: 'scene-scene-dsl',          scrollOffset: SCENE_SCROLL_OFFSETS['scene-scene-dsl'] },
      { label: 'Multi-Scene Sequences',  sceneId: 'scene-multi-scene',        scrollOffset: SCENE_SCROLL_OFFSETS['scene-multi-scene'] },
      { label: 'Transitions & Easing',   sceneId: 'scene-transitions',        scrollOffset: SCENE_SCROLL_OFFSETS['scene-transitions'] },
      { label: 'ProgressManager',        sceneId: 'scene-progress-manager',   scrollOffset: SCENE_SCROLL_OFFSETS['scene-progress-manager'] },
    ],
  },
  {
    title: 'Elements',
    actSceneId: 'act-elements',
    items: [
      { label: 'Camera',                 sceneId: 'scene-camera',             scrollOffset: SCENE_SCROLL_OFFSETS['scene-camera'] },
      { label: 'Lighting',               sceneId: 'scene-lighting',           scrollOffset: SCENE_SCROLL_OFFSETS['scene-lighting'] },
      { label: 'Background',             sceneId: 'scene-background',         scrollOffset: SCENE_SCROLL_OFFSETS['scene-background'] },
      { label: 'Environment',            sceneId: 'scene-environment',        scrollOffset: SCENE_SCROLL_OFFSETS['scene-environment'] },
      { label: 'Floor',                  sceneId: 'scene-floor',              scrollOffset: SCENE_SCROLL_OFFSETS['scene-floor'] },
    ],
  },
  {
    title: 'Overlay Content',
    actSceneId: 'act-overlay-content',
    items: [
      { label: 'Scene Overlay',          sceneId: 'scene-hud',                scrollOffset: SCENE_SCROLL_OFFSETS['scene-hud'] },
      { label: 'Anime.js Presets',       sceneId: 'scene-hud-animejs',        scrollOffset: SCENE_SCROLL_OFFSETS['scene-hud-animejs'] },
    ],
  },
  {
    title: 'Input',
    actSceneId: 'act-input',
    items: [
      { label: 'Scene Navigation',       sceneId: 'scene-input-navigation',   scrollOffset: SCENE_SCROLL_OFFSETS['scene-input-navigation'] },
      { label: 'Input Actions',          sceneId: 'scene-input-actions',      scrollOffset: SCENE_SCROLL_OFFSETS['scene-input-actions'] },
    ],
  },
  {
    title: 'Player & Hooks',
    actSceneId: 'act-player-hooks',
    items: [
      { label: 'ScenePlayer & EngineProvider', sceneId: 'scene-player',       scrollOffset: SCENE_SCROLL_OFFSETS['scene-player'] },
      { label: 'Hooks Reference',        sceneId: 'scene-hooks',              scrollOffset: SCENE_SCROLL_OFFSETS['scene-hooks'] },
    ],
  },
  {
    title: 'Widget SDK',
    actSceneId: 'act-widget-sdk',
    items: [
      { label: 'Overview',               sceneId: 'scene-widget-sdk',         scrollOffset: SCENE_SCROLL_OFFSETS['scene-widget-sdk'] },
      { label: 'Custom Widget',          sceneId: 'scene-custom-widget',      scrollOffset: SCENE_SCROLL_OFFSETS['scene-custom-widget'] },
      { label: 'VariableStore',          sceneId: 'scene-variable-store',     scrollOffset: SCENE_SCROLL_OFFSETS['scene-variable-store'] },
      { label: 'Widget Registry',        sceneId: 'scene-widget-registry',    scrollOffset: SCENE_SCROLL_OFFSETS['scene-widget-registry'] },
    ],
  },
  {
    title: 'Reference',
    actSceneId: 'act-reference',
    items: [
      { label: 'API Reference',          sceneId: 'scene-api-reference',      scrollOffset: SCENE_SCROLL_OFFSETS['scene-api-reference'] },
      { label: 'Timeline & Math',        sceneId: 'scene-timeline',           scrollOffset: SCENE_SCROLL_OFFSETS['scene-timeline'] },
    ],
  },
];
