// docs/src/docs-nav.ts
import { defineDocsNav } from '@brewsite/docs';

const navDef = defineDocsNav([
  {
    title: 'Getting Started',
    sections: [
      { id: 'getting-started',  label: 'What is BrewSite Core?' },
      { id: 'installation',     label: 'Installation' },
      { id: 'quick-start',      label: 'Quick Start' },
      { id: 'concepts',         label: 'Core Concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    sections: [
      { id: 'scene-dsl',        label: 'Scene DSL' },
      { id: 'multi-scene',      label: 'Multi-Scene Sequences' },
      { id: 'transitions',      label: 'Transitions & Easing' },
    ],
  },
  {
    title: 'Elements',
    sections: [
      { id: 'model',            label: 'Model' },
      { id: 'camera',           label: 'Camera' },
      { id: 'lighting',         label: 'Lighting' },
      { id: 'background',       label: 'Background' },
      { id: 'environment',      label: 'Environment' },
      { id: 'floor',            label: 'Floor' },
    ],
  },
  {
    title: 'Overlay Content',
    sections: [
      { id: 'hud',              label: 'Scene Overlay' },
      { id: 'hud-animejs',      label: 'Anime.js Presets' },
      { id: 'labels',           label: 'Label System' },
    ],
  },
  {
    title: 'Input',
    sections: [
      { id: 'input-navigation', label: 'Scene Navigation' },
      { id: 'input-actions',    label: 'Input Actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    sections: [
      { id: 'player',           label: 'ScenePlayer & EngineProvider' },
      { id: 'hooks',            label: 'Hooks Reference' },
    ],
  },
  {
    title: 'Widget SDK',
    sections: [
      { id: 'widget-sdk',       label: 'Overview' },
      { id: 'custom-widget',    label: 'Custom Widget' },
      { id: 'variable-store',   label: 'VariableStore' },
      { id: 'widget-registry',  label: 'Widget Registry' },
    ],
  },
  {
    title: 'Reference',
    sections: [
      { id: 'api-reference',    label: 'API Reference' },
      { id: 'timeline',         label: 'Timeline & Math' },
    ],
  },
] as const);

export const docsNav = navDef.docsNav;
export type SectionId = typeof navDef.SectionId;
