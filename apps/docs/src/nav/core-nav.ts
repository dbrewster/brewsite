import type { NavSection } from './types';

export const coreNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'What is BrewSite Core?', path: '/core/getting-started' },
      { label: 'Installation', path: '/core/installation' },
      { label: 'Quick Start', path: '/core/quick-start' },
      { label: 'Core Concepts', path: '/core/concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    items: [
      { label: 'Scene DSL', path: '/core/scene-dsl' },
      { label: 'Multi-Scene Sequences', path: '/core/multi-scene' },
      { label: 'Transitions & Easing', path: '/core/transitions' },
      { label: 'ProgressManager', path: '/core/progress-manager' },
    ],
  },
  {
    title: 'Elements',
    items: [
      { label: 'Camera', path: '/core/camera' },
      { label: 'Lighting', path: '/core/lighting' },
      { label: 'Background', path: '/core/background' },
      { label: 'Environment', path: '/core/environment' },
      { label: 'Floor', path: '/core/floor' },
    ],
  },
  {
    title: 'Overlay Content',
    items: [
      { label: 'Scene Overlay', path: '/core/hud' },
      { label: 'Anime.js Presets', path: '/core/hud-animejs' },
    ],
  },
  {
    title: 'Input',
    items: [
      { label: 'Scene Navigation', path: '/core/input-navigation' },
      { label: 'Input Actions', path: '/core/input-actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    items: [
      { label: 'ScenePlayer & EngineProvider', path: '/core/player' },
      { label: 'Hooks Reference', path: '/core/hooks' },
    ],
  },
  {
    title: 'Widget SDK',
    items: [
      { label: 'Overview', path: '/core/widget-sdk' },
      { label: 'Custom Widget', path: '/core/custom-widget' },
      { label: 'VariableStore', path: '/core/variable-store' },
      { label: 'Widget Registry', path: '/core/widget-registry' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'API Reference', path: '/core/api-reference' },
      { label: 'Timeline & Math', path: '/core/timeline' },
    ],
  },
];
