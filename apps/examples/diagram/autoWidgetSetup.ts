// Widget setup for the diagram-auto demo page.
// Uses DiagramCanvasWidget with id 'auto-canvas' containing the auto-layout diagram.

import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import {
  DiagramCanvasWidget,
  compileCanvas,
  compileDiagram,
  registerDiagramHandlers,
} from '@brewsite/diagram';

export const createAutoWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();

  const registry = createDefaultWidgetRegistry(manifest);

  // Default state: same topology as the scene but compiled with auto-layout.
  // The ScenePlayer will replace this with the DSL-compiled state on first tick.
  const canvasDefault = compileCanvas(
    { id: 'auto-canvas' },
    [
      compileDiagram({
        id: 'arch-auto',
        layout: 'hierarchical',
        layoutSpacing: [3, 5],
        pivot: 'center',
        nodes: [
          { id: 'browser', label: 'Web Browser',    shape: 'flow:actor' },
          { id: 'cdn',     label: 'CloudFront CDN', shape: 'aws:cloudfront' },
          { id: 'alb',     label: 'Load Balancer',  shape: 'aws:alb' },
          { id: 'api',     label: 'API Gateway',    shape: 'aws:api-gateway' },
          { id: 'ecs',     label: 'ECS Cluster',    shape: 'aws:ecs' },
          { id: 'lambda',  label: 'Lambda',         shape: 'aws:lambda' },
          { id: 'rds',     label: 'RDS PostgreSQL', shape: 'aws:rds' },
          { id: 'cache',   label: 'ElastiCache',    shape: 'aws:elasticache' },
          { id: 's3',      label: 'S3 Assets',      shape: 'aws:s3' },
        ],
        edges: [
          { from: 'browser', to: 'cdn' },
          { from: 'cdn',     to: 'alb' },
          { from: 'alb',     to: 'api' },
          { from: 'api',     to: 'ecs' },
          { from: 'api',     to: 'lambda' },
          { from: 'ecs',     to: 'rds' },
          { from: 'ecs',     to: 'cache' },
          { from: 'ecs',     to: 's3' },
        ],
        groups: [],
      }),
    ],
    [],
  );

  registry.register(new DiagramCanvasWidget('auto-canvas', canvasDefault));

  return registry;
};
