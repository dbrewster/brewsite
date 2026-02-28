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
  // NOTE: iconStyle / iconDepth / metalness / roughness must mirror scene_arch_auto.tsx
  // so the initial render already uses 3D icons — no flat→3D flash on first load.
  const canvasDefault = compileCanvas(
    { id: 'auto-canvas' },
    [
      compileDiagram({
        id: 'arch-auto',
        layout: { kind: 'hierarchical', spacing: [3, 2] },
        pivot: 'center',
        nodes: [
          { id: 'browser', label: 'Web Browser',    shape: 'flow:actor' },
          { id: 'cdn',     label: 'CloudFront CDN', shape: 'aws:cloudfront',
            clickable: true, metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
          { id: 'alb',     label: 'Load Balancer',  shape: 'aws:alb',
            clickable: true, metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
          { id: 'api',     label: 'API Gateway',    shape: 'aws:api-gateway',
            clickable: true, metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
          { id: 'ecs',     label: 'ECS Cluster',    shape: 'aws:ecs',
            clickable: true, metalness: 0.25, roughness: 0.35, iconStyle: 'extruded', iconDepth: 0.35 },
          { id: 'lambda',  label: 'Lambda',         shape: 'aws:lambda',
            clickable: true, color: '#2a2d4e', metalness: 0.55, roughness: 0.25, iconStyle: 'embossed', iconDepth: 0.32 },
          { id: 'rds',     label: 'RDS PostgreSQL', shape: 'aws:rds',
            metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
          { id: 'cache',   label: 'ElastiCache',    shape: 'aws:elasticache',
            metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
          { id: 's3',      label: 'S3 Assets',      shape: 'aws:s3',
            metalness: 0.25, roughness: 0.35, iconStyle: 'layered', iconDepth: 0.35 },
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
