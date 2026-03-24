// Sidebar navigation configuration for the continuous-scroll docs layout.
//
// DELETED:
//   SCENE_SCROLL_REGISTRY   — scroll budget registry (replaced by live IntersectionObserver)
//   TOTAL_SCROLL_HEIGHT      — sum of all scrollUnits (no longer meaningful)
//   SCENE_SCROLL_OFFSETS     — precomputed pixel offsets (replaced by scrollToSection())
//
// Navigation now uses DOM element ids + NavContext.scrollToSection(id, progress?).

import type { NavSection } from './types';

export const docsNav: NavSection[] = [
  {
    title: 'Getting Started',
    actId: 'act-getting-started',
    items: [
      { label: 'What is BrewSite Core?', id: 'scene-what-is-brewsite' },
      { label: 'Installation',           id: 'scene-installation' },
      { label: 'Quick Start',            id: 'scene-quick-start' },
      { label: 'Core Concepts',          id: 'scene-concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    actId: 'act-scene-authoring',
    items: [
      { label: 'Scene DSL',              id: 'scene-scene-dsl' },
      { label: 'Multi-Scene Sequences',  id: 'scene-multi-scene' },
      { label: 'Transitions & Easing',   id: 'scene-transitions' },
      { label: 'ProgressManager',        id: 'scene-progress-manager' },
    ],
  },
  {
    title: 'Elements',
    actId: 'act-elements',
    items: [
      { label: 'Camera',                 id: 'scene-camera' },
      { label: 'Lighting',               id: 'scene-lighting' },
      { label: 'Background',             id: 'scene-background' },
      { label: 'Environment',            id: 'scene-environment' },
      { label: 'Floor',                  id: 'scene-floor' },
    ],
  },
  {
    title: 'Overlay Content',
    actId: 'act-overlay-content',
    items: [
      { label: 'Scene Overlay',          id: 'scene-hud' },
      { label: 'Anime.js Presets',       id: 'scene-hud-animejs' },
    ],
  },
  {
    title: 'Input',
    actId: 'act-input',
    items: [
      { label: 'Scene Navigation',       id: 'scene-input-navigation' },
      { label: 'Input Actions',          id: 'scene-input-actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    actId: 'act-player-hooks',
    items: [
      { label: 'SceneEngine & EngineProvider', id: 'scene-player' },
      { label: 'Hooks Reference',              id: 'scene-hooks' },
    ],
  },
  {
    title: 'Widget SDK',
    actId: 'act-widget-sdk',
    items: [
      { label: 'Overview',               id: 'scene-widget-sdk' },
      { label: 'Custom Widget',          id: 'scene-custom-widget' },
      { label: 'VariableStore',          id: 'scene-variable-store' },
      { label: 'Widget Registry',        id: 'scene-widget-registry' },
    ],
  },
  {
    title: 'Reference',
    actId: 'act-reference',
    items: [
      { label: 'API Reference',          id: 'scene-api-reference' },
      { label: 'Timeline & Math',        id: 'scene-timeline' },
    ],
  },
];
