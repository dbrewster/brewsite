import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import {
  DiagramWidget,
  ImagePanelWidget,
  ScreenWidget,
  compileDiagram,
  compileImagePanel,
  compileScreen,
  registerDiagramHandlers,
} from '@brewsite/diagram';

export const createWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();

  const registry = createDefaultWidgetRegistry(manifest);

  const diagramDefault = compileDiagram({
    id: 'diagram-basic',
    layout: 'manual',
    layoutSpacing: [2, 2],
    nodes: [
      { id: 'frontend', label: 'Frontend', position: [-6, 2, 0], shape: 'flow:rounded' },
      { id: 'api', label: 'API', position: [0, 2, 0], shape: 'flow:rect' },
      { id: 'db', label: 'Database', position: [6, 2, 0], shape: 'flow:cylinder' },
    ],
    edges: [
      { from: 'frontend', to: 'api' },
      { from: 'api', to: 'db' },
    ],
    groups: [],
  });

  const panelDefault = compileImagePanel({
    id: 'diagram-image',
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    position: [-4, -6, 6],
    rotation: [0, -0.2, 0],
    width: 8,
    bezel: 'dark',
    gloss: 0.6,
    selfIllumination: 0.2,
    glow: true,
    glowColor: '#4488ff',
  });

  const screenDefault = compileScreen({
    id: 'diagram-screen',
    src: 'https://example.com',
    position: [6, -6, 6],
    rotation: [0, 0, 0],
    width: 8,
    height: 4.5,
    bezel: 'chrome',
    glow: true,
    glowColor: '#6699ff',
  });

  registry
    .register(new DiagramWidget('diagram-basic', diagramDefault))
    .register(new ImagePanelWidget('diagram-image', panelDefault))
    .register(new ScreenWidget('diagram-screen', screenDefault));

  return registry;
};
