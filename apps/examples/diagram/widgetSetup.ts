import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import {
  DiagramCanvasWidget,
  ImagePanelWidget,
  ScreenWidget,
  compileCanvas,
  compileDiagram,
  compileImagePanel,
  compileScreen,
  registerDiagramHandlers,
} from '@brewsite/diagram';

export const createWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();

  const registry = createDefaultWidgetRegistry(manifest);

  const canvasDefault = compileCanvas(
    { id: 'system-canvas' },
    [
      compileDiagram({
        id: 'system-arch',
        layout: 'manual',
        layoutSpacing: [2, 2],
        pivot: 'center',
        nodes: [
          { id: 'browser', label: 'Web Browser', position: [-6, 6, 0], shape: 'flow:actor' },
          { id: 'cdn', label: 'CloudFront CDN', position: [0, 2, 0], shape: 'aws:cloudfront' },
          { id: 'alb', label: 'Load Balancer', position: [0, -1, 0], shape: 'aws:alb' },
          { id: 'api', label: 'API Gateway', position: [0, -4, 0], shape: 'aws:api-gateway' },
          { id: 'ecs', label: 'ECS Cluster', position: [-5, -8, 0], shape: 'aws:ecs' },
          { id: 'lambda', label: 'Lambda', position: [5, -8, 0], shape: 'aws:lambda' },
          { id: 'rds', label: 'RDS PostgreSQL', position: [-5, -13, 0], shape: 'aws:rds' },
          { id: 'cache', label: 'ElastiCache', position: [0, -13, 0], shape: 'aws:elasticache' },
          { id: 's3', label: 'S3 Assets', position: [5, -13, 0], shape: 'aws:s3' },
        ],
        edges: [
          { from: 'browser', to: 'cdn' }, { from: 'cdn', to: 'alb' },
          { from: 'alb', to: 'api' }, { from: 'api', to: 'ecs' },
          { from: 'api', to: 'lambda' }, { from: 'ecs', to: 'rds' },
          { from: 'ecs', to: 'cache' }, { from: 'ecs', to: 's3' },
        ],
        groups: [],
      }),
    ],
    [],
  );

  const panelDefault = compileImagePanel({
    id: 'api-docs-screenshot',
    src: '/screenshots/api-docs.png',
    position: [5, -4, 12],
    rotation: [0, -0.2, 0],
    width: 8,
    bezel: 'dark',
    gloss: 0.6,
    selfIllumination: 0.2,
    glow: true,
    glowColor: '#4488ff',
    enabled: false,
  });

  const screenDefault = compileScreen({
    id: 'api-explorer-live',
    src: 'http://localhost:5173/simple',
    position: [5, -9, 14],
    rotation: [0, 0, 0],
    width: 10,
    height: 6.25,
    bezel: 'chrome',
    glow: true,
    glowColor: '#6699ff',
    enabled: false,
  });

  registry
    .register(new DiagramCanvasWidget('system-canvas', canvasDefault))
    .register(new ImagePanelWidget('api-docs-screenshot', panelDefault))
    .register(new ScreenWidget('api-explorer-live', screenDefault));

  return registry;
};
