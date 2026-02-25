---
title: "@brewsite/diagram — 3D Immersive Diagram Package Implementation Plan"
doc_type: plan
owner: architecture
status: active
updated: 2026-02-25
---

# `@brewsite/diagram` — Implementation Plan
## 3D Immersive Engineering Diagrams, Image Panels, and Live Screens

---

## 1. Package Identity and Purpose

**Package name:** `@brewsite/diagram`
**Location:** `packages/diagram/`
**Depends on:** `@brewsite/core` (workspace peer)
**Published:** Yes (separate installable package)

This package provides three new element modules for the BrewSite scene engine:

1. **`diagram` element** — Renders engineering/architecture diagrams as fully 3D scenes.
   Nodes are shallow physical boxes with labels and icons. Edges are routed 3D tubes.
   Groups are wireframe boundary containers. Designed for drill-down animations via
   the existing BrewSite scene transition system.

2. **`image-panel` element** — Renders a static image (screenshot, UI mockup, any PNG/JPG)
   as a physical 3D floating frame in world space. Fully WebGL: `MeshPhysicalMaterial`
   clearcoat for screen gloss, physical bezel geometry, optional glow halo. Supports
   rotation, tilt, and lighting like any other Three.js mesh.

3. **`screen` element** — Renders a live, interactive website inside a physical 3D bezel
   frame. The website content is a real `<iframe>` DOM element overlaid on the WebGL
   canvas at the correct screen-space position. The bezel and glow are WebGL. The iframe
   is fully interactive (real browser, real clicks, real scrolling). Should face the camera
   with minimal tilt — the website appears 2D and interactive while the 3D scene continues
   behind it.

**The key distinction:** `ImagePanel` and `Screen` share no rendering code. `ImagePanel` is
pure Three.js (texture on a plane). `Screen` is a hybrid: WebGL bezel + DOM iframe tracked
by world-to-screen projection each frame. Shared visual utilities (bezel geometry, glow
sprite) live in `src/elements/_shared/`.

Both elements follow the mandatory BrewSite element module pattern:

```
types.ts → dsl.tsx → compile.ts → render.ts → index.ts
```

With the following hard dependency constraints:
- `types.ts` — no runtime imports, no Three.js, no React
- `dsl.tsx` — React only; no Three.js, no compiler internals
- `compile.ts` — pure functions; no Three.js, no React
- `render.ts` — Three.js only; no React, no compiler imports
- `index.ts` — re-exports only; no new logic

---

## 2. Complete File and Directory Structure

```
packages/diagram/
├── src/
│   ├── index.ts                          ← public package exports
│   │
│   ├── elements/
│   │   │
│   │   ├── _shared/                      ← shared WebGL utilities (bezel + glow)
│   │   │   ├── bezelGeometry.ts          ← createBezel(variant, w, h, thickness): THREE.Group
│   │   │   └── glowSprite.ts             ← createGlow(color, scale, opacity): THREE.Sprite
│   │   │
│   │   ├── diagram/                      ← diagram element module
│   │   │   ├── types.ts                  ← ALL type contracts
│   │   │   ├── dsl.tsx                   ← <Diagram>, <DiagramNode>, <DiagramEdge>, <DiagramGroup>
│   │   │   ├── compile.ts                ← layout, edge routing, icon resolution, functionalDiagramTransitionSpec
│   │   │   ├── render.ts                 ← Three.js geometry, materials, text, raycasting reg.
│   │   │   ├── widget.ts                 ← DiagramWidget: ISceneElement<DiagramState> — wires compile + render
│   │   │   ├── index.ts                  ← re-exports
│   │   │   ├── shapes/
│   │   │   │   ├── geometryFactory.ts    ← Three.js geometry per shape variant
│   │   │   │   ├── iconRegistry.ts       ← shape → public asset URL mapping
│   │   │   │   └── shapeVariants.ts      ← full DiagramShapeVariant union type (imported by types.ts)
│   │   │   ├── math/
│   │   │   │   └── colorUtils.ts         ← deriveColor(hex, delta): string — pure hex color manipulation
│   │   │   └── __tests__/
│   │   │       ├── compile.test.ts       ← layout resolution, edge routing
│   │   │       ├── colorUtils.test.ts    ← deriveColor correctness
│   │   │       ├── shapeVariants.test.ts ← type guard tests
│   │   │       └── iconRegistry.test.ts  ← icon URL resolution
│   │   │
│   │   ├── image-panel/                  ← ImagePanel element — static image, pure WebGL
│   │   │   ├── types.ts                  ← ImagePanelState, ImagePanelDSL
│   │   │   ├── dsl.tsx                   ← <ImagePanel>
│   │   │   ├── compile.ts                ← compileImagePanel(), functionalImagePanelTransitionSpec
│   │   │   ├── render.ts                 ← PlaneGeometry + MeshPhysicalMaterial + bezel + glow
│   │   │   ├── widget.ts                 ← ImagePanelWidget: ISceneElement<ImagePanelState>
│   │   │   ├── index.ts                  ← re-exports
│   │   │   └── __tests__/
│   │   │       └── compile.test.ts
│   │   │
│   │   └── screen/                       ← Screen element — live iframe, WebGL bezel + DOM overlay
│   │       ├── types.ts                  ← ScreenState, ScreenDSL
│   │       ├── dsl.tsx                   ← <Screen>
│   │       ├── compile.ts                ← compileScreen(), functionalScreenTransitionSpec
│   │       ├── render.ts                 ← WebGL bezel + DOM <iframe> tracked via world→screen projection
│   │       ├── widget.ts                 ← ScreenWidget: ISceneElement<ScreenState>
│   │       ├── index.ts                  ← re-exports
│   │       └── __tests__/
│   │           └── compile.test.ts
│   │
│   └── compiler/
│       └── handlers.ts                   ← registers diagram + image-panel + screen handlers
│
├── public/
│   └── assets/
│       └── shapes/
│           ├── aws/                      ← AWS Architecture Icons (SVG) — download separately
│           │   ├── ec2.svg
│           │   ├── s3.svg
│           │   ├── rds.svg
│           │   ├── lambda.svg
│           │   ├── alb.svg
│           │   ├── cloudfront.svg
│           │   ├── vpc.svg
│           │   ├── ecs.svg
│           │   ├── eks.svg
│           │   ├── sqs.svg
│           │   ├── sns.svg
│           │   ├── api-gateway.svg
│           │   ├── elasticache.svg
│           │   └── dynamodb.svg
│           ├── gcp/                      ← Google Cloud icons — download separately
│           │   ├── compute-engine.svg
│           │   ├── cloud-run.svg
│           │   ├── bigquery.svg
│           │   ├── cloud-storage.svg
│           │   └── pubsub.svg
│           ├── azure/                    ← Azure icons — download separately
│           │   └── app-service.svg
│           └── flow/                     ← Hand-authored generic shapes (SVG)
│               ├── cloud.svg
│               ├── actor.svg
│               ├── document.svg
│               └── queue.svg
│
├── scripts/
│   └── import-lucid.mjs                 ← build-time Lucid .lucid → DSL converter
│
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

---

## 3. Shape Library Design

### 3.1 `src/elements/diagram/shapes/shapeVariants.ts`

This file defines the complete `DiagramShapeVariant` union type. It is imported by `types.ts`
and used throughout the element. It lives in `shapes/` to isolate the large union from the
core type contracts.

```typescript
// src/elements/diagram/shapes/shapeVariants.ts
// Exhaustive shape variant type for diagram nodes.

/**
 * Generic flowchart shapes. Rendered as pure Three.js geometry — no external assets required.
 * These cover all standard ISO 5807 flowchart symbols.
 */
export type FlowShape =
  | 'flow:rect'           // Process / component / service (BoxGeometry)
  | 'flow:rounded'        // Modern service / API endpoint (BoxGeometry + rounded shader)
  | 'flow:diamond'        // Decision / gateway / branch (rotated BoxGeometry)
  | 'flow:cylinder'       // Database / data store (CylinderGeometry)
  | 'flow:cylinder-stack' // Clustered databases / replicated store (stacked cylinders)
  | 'flow:oval'           // Terminator: start / end / user / external system
  | 'flow:cloud'          // External service / internet / third-party (SVG sprite)
  | 'flow:actor'          // Person / user / operator (SVG person icon on plane)
  | 'flow:document'       // Document / report / output artifact (SVG sprite)
  | 'flow:queue'          // Message queue / broker (horizontal cylinder or parallelogram)
  | 'flow:hexagon'        // Compute step / preprocessing (HexagonGeometry)
  | 'flow:parallelogram'; // Data input / output (skewed BoxGeometry)

/**
 * AWS Architecture shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Icon SVGs sourced from official AWS Architecture Icons (CC-BY-ND 2.0).
 * Download: https://aws.amazon.com/architecture/icons/
 */
export type AwsShape =
  | 'aws:ec2'
  | 'aws:s3'
  | 'aws:rds'
  | 'aws:lambda'
  | 'aws:alb'
  | 'aws:cloudfront'
  | 'aws:vpc'
  | 'aws:ecs'
  | 'aws:eks'
  | 'aws:sqs'
  | 'aws:sns'
  | 'aws:api-gateway'
  | 'aws:elasticache'
  | 'aws:dynamodb';

/**
 * Google Cloud Platform shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Icon SVGs sourced from Google Cloud icon set (Apache 2.0).
 * Download: https://cloud.google.com/icons
 */
export type GcpShape =
  | 'gcp:compute-engine'
  | 'gcp:cloud-run'
  | 'gcp:bigquery'
  | 'gcp:cloud-storage'
  | 'gcp:pubsub';

/**
 * Azure shapes. Open string union — enumerate as icons are added.
 * Download: https://learn.microsoft.com/en-us/azure/architecture/icons/
 */
export type AzureShape = `azure:${string}`;

/**
 * Network / infrastructure shapes. Pure Three.js geometry or SVG sprites.
 */
export type NetworkShape =
  | 'net:router'
  | 'net:switch'
  | 'net:firewall'
  | 'net:load-balancer'
  | 'net:server'
  | 'net:desktop'
  | 'net:mobile';

/**
 * Full shape variant union.
 * `custom:${string}` is the escape hatch — unknown custom: shapes fall back to flow:rect
 * at render time with a console.warn. This prevents hard failures for one-off shapes.
 */
export type DiagramShapeVariant =
  | FlowShape
  | AwsShape
  | GcpShape
  | AzureShape
  | NetworkShape
  | `custom:${string}`;

/** Type guard — returns true for shapes that require an external icon asset */
export function shapeRequiresIcon(shape: DiagramShapeVariant): boolean {
  return (
    shape.startsWith('aws:') ||
    shape.startsWith('gcp:') ||
    shape.startsWith('azure:') ||
    shape === 'flow:cloud' ||
    shape === 'flow:actor' ||
    shape === 'flow:document' ||
    shape === 'flow:queue'
  );
}
```

### 3.2 `src/elements/diagram/shapes/iconRegistry.ts`

Maps shape variants to public asset paths. The paths are relative to the package's `public/`
directory, which the consuming Vite app must serve.

```typescript
// src/elements/diagram/shapes/iconRegistry.ts
// Maps DiagramShapeVariant values to public asset URL paths.

import type { DiagramShapeVariant } from './shapeVariants.ts';

// IMPORTANT: Do NOT type this as Partial<Record<DiagramShapeVariant, string>>.
// DiagramShapeVariant includes AzureShape = `azure:${string}` which is an open
// template literal type. TypeScript cannot enumerate it as Record keys and will error:
// "Type 'Record<DiagramShapeVariant, string>' has infinite/unmappable keys."
// Use an explicit known-key subset type instead.
type KnownIconShape = AwsShape | GcpShape | 'flow:cloud' | 'flow:actor' | 'flow:document' | 'flow:queue';
const ICON_MAP: Partial<Record<KnownIconShape, string>> = {
  // AWS
  'aws:ec2':         '/assets/shapes/aws/ec2.svg',
  'aws:s3':          '/assets/shapes/aws/s3.svg',
  'aws:rds':         '/assets/shapes/aws/rds.svg',
  'aws:lambda':      '/assets/shapes/aws/lambda.svg',
  'aws:alb':         '/assets/shapes/aws/alb.svg',
  'aws:cloudfront':  '/assets/shapes/aws/cloudfront.svg',
  'aws:vpc':         '/assets/shapes/aws/vpc.svg',
  'aws:ecs':         '/assets/shapes/aws/ecs.svg',
  'aws:eks':         '/assets/shapes/aws/eks.svg',
  'aws:sqs':         '/assets/shapes/aws/sqs.svg',
  'aws:sns':         '/assets/shapes/aws/sns.svg',
  'aws:api-gateway': '/assets/shapes/aws/api-gateway.svg',
  'aws:elasticache': '/assets/shapes/aws/elasticache.svg',
  'aws:dynamodb':    '/assets/shapes/aws/dynamodb.svg',
  // GCP
  'gcp:compute-engine': '/assets/shapes/gcp/compute-engine.svg',
  'gcp:cloud-run':      '/assets/shapes/gcp/cloud-run.svg',
  'gcp:bigquery':       '/assets/shapes/gcp/bigquery.svg',
  'gcp:cloud-storage':  '/assets/shapes/gcp/cloud-storage.svg',
  'gcp:pubsub':         '/assets/shapes/gcp/pubsub.svg',
  // Flow (SVG-based)
  'flow:cloud':    '/assets/shapes/flow/cloud.svg',
  'flow:actor':    '/assets/shapes/flow/actor.svg',
  'flow:document': '/assets/shapes/flow/document.svg',
  'flow:queue':    '/assets/shapes/flow/queue.svg',
};

/**
 * Returns the public asset URL for a shape's icon, or undefined if the shape
 * is rendered as pure Three.js geometry (no external asset needed).
 */
export function resolveIconUrl(shape: DiagramShapeVariant): string | undefined {
  // Handle azure:* open union and custom:* escape hatch
  if (shape.startsWith('azure:')) {
    const key = shape.replace('azure:', '');
    return `/assets/shapes/azure/${key}.svg`;
  }
  return ICON_MAP[shape as keyof typeof ICON_MAP];
}
```

---

## 4. `types.ts` — Complete Type Contracts

### 4.1 `src/elements/diagram/types.ts`

```typescript
// src/elements/diagram/types.ts
// Contract layer for the diagram element. No runtime imports, no Three.js, no React.

import type { DiagramShapeVariant } from './shapes/shapeVariants.ts';

// ─── Node ───────────────────────────────────────────────────────────────────

/** Visual variant for edge connector lines */
export type DiagramEdgeStyle = 'solid' | 'dashed' | 'dotted';

/** Arrowhead variant at a connector endpoint */
export type DiagramArrowVariant = 'none' | 'open' | 'filled' | 'diamond' | 'circle';

/** Group container visual variant */
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster';

/** Swimlane orientation when variant is 'swimlane' */
export type DiagramOrientation = 'horizontal' | 'vertical';

/**
 * Fully resolved state for a single diagram node.
 * All positions are in diagram units (1 unit ≈ scene world unit before diagram scale is applied).
 * Produced by compile.ts from DiagramNodeDSL.
 */
export interface DiagramNodeState {
  /** Unique node ID within this diagram */
  readonly id: string;

  /** Primary display label */
  readonly label: string;

  /** Optional secondary label rendered below the primary label in smaller text */
  readonly sublabel: string | undefined;

  /**
   * Shape variant determining geometry and icon.
   * Geometry variants (flow:rect, flow:diamond, etc.) use pure Three.js geometry.
   * Icon variants (aws:*, gcp:*, azure:*) overlay an SVG texture on the front face.
   */
  readonly shape: DiagramShapeVariant;

  /**
   * World-space position of the node center [x, y, z].
   * z is the primary axis for depth-reveal animations — the "flat" view has all nodes
   * at z=0; expanded views use non-zero z to create depth.
   */
  readonly position: readonly [number, number, number];

  /** Node width and height in diagram units [w, h]. */
  readonly size: readonly [number, number];

  /**
   * Physical box depth in diagram units.
   * Recommended default: 0.4 for standard nodes, 0.8 for "hero" expanded nodes.
   * Option B rendering: nodes are actual BoxGeometry objects, not flat planes.
   */
  readonly depth: number;

  /** CSS hex color for the node box face (e.g., '#dae8fc') */
  readonly color: string;

  /** CSS hex color for the node box side/edge faces */
  readonly sideColor: string;

  /** CSS hex color for the node border outline (LineSegments overlay) */
  readonly borderColor: string;

  /** Box material metalness [0–1]. Default: 0.15 */
  readonly metalness: number;

  /** Box material roughness [0–1]. Default: 0.65 (matte industrial) */
  readonly roughness: number;

  /** CSS hex color for label text */
  readonly labelColor: string;

  /** CSS hex color for sublabel text */
  readonly sublabelColor: string;

  /** Node opacity [0–1] */
  readonly opacity: number;

  /**
   * Whether this node is registered for click/raycast interaction.
   * When true, render.ts registers the node's front-face mesh with the interaction registry.
   */
  readonly clickable: boolean;

  /**
   * Whether this node is rendered at all.
   * Allows nodes to be hidden in one scene and shown in another during a transition.
   */
  readonly enabled: boolean;

  /**
   * Resolved public asset URL for the shape icon, or undefined for geometry-only shapes.
   * Populated by compile.ts via iconRegistry.resolveIconUrl(shape).
   * render.ts loads this URL via THREE.SVGLoader and composites it on the front face.
   */
  readonly iconUrl: string | undefined;

  /**
   * Icon display scale relative to node face [0–1].
   * At 1.0 the icon fills the full node width; 0.5 is half width.
   * Default: 0.6
   */
  readonly iconScale: number;

  /** ID of the parent DiagramGroup, or undefined if top-level */
  readonly groupId: string | undefined;
}

// ─── Edge ───────────────────────────────────────────────────────────────────

/**
 * Fully resolved state for a single diagram edge (connector).
 * Produced by compile.ts from DiagramEdgeDSL, including computed control points.
 */
export interface DiagramEdgeState {
  readonly id: string;

  /** ID of the node this edge originates from */
  readonly fromId: string;

  /** ID of the node this edge terminates at */
  readonly toId: string;

  /** Optional label displayed at the midpoint of the edge */
  readonly label: string | undefined;

  /** Line visual style */
  readonly style: DiagramEdgeStyle;

  /** Arrowhead at the origin end */
  readonly arrowStart: DiagramArrowVariant;

  /** Arrowhead at the destination end */
  readonly arrowEnd: DiagramArrowVariant;

  /** CSS hex edge color */
  readonly color: string;

  /**
   * Tube geometry radius in diagram units.
   * Recommended: 0.04 for standard edges, 0.07 for highlighted/emphasized edges.
   */
  readonly thickness: number;

  /**
   * Bezier/catmull-rom control points for the edge path, in world space.
   * Computed by compile.ts edge router. Always has ≥ 2 points (start and end).
   * The start point is offset from the source node's nearest face center.
   * The end point is offset from the destination node's nearest face center.
   * Intermediate points create smooth routing around obstacles.
   */
  readonly controlPoints: ReadonlyArray<readonly [number, number, number]>;

  /** Edge opacity [0–1] */
  readonly opacity: number;
}

// ─── Group ──────────────────────────────────────────────────────────────────

/**
 * Fully resolved state for a diagram group (swimlane, boundary, or cluster).
 * Bounding box is computed by compile.ts from the positions of member nodes.
 */
export interface DiagramGroupState {
  readonly id: string;

  /** Display label for the group header */
  readonly label: string;

  readonly variant: DiagramGroupVariant;

  /** Swimlane divider orientation. Only meaningful when variant is 'swimlane'. */
  readonly orientation: DiagramOrientation;

  /**
   * Computed bounding box of all member nodes in diagram units.
   * Includes a padding margin around the outermost node edges.
   * Populated by compile.ts after layout resolution.
   */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly padding: number;
  };

  /** CSS hex fill color for the group interior. Typically semi-transparent. */
  readonly color: string;

  /** CSS hex border color */
  readonly borderColor: string;

  readonly borderStyle: 'solid' | 'dashed';

  /** Fill opacity [0–1]. Recommended: 0.05–0.12 for subtle background wash. */
  readonly fillOpacity: number;

  /** Border opacity [0–1] */
  readonly borderOpacity: number;
}

// ─── Diagram (top-level compiled state) ─────────────────────────────────────

/**
 * The fully compiled state of a diagram element.
 * This is what render.ts receives — all layout has been resolved, all icons
 * have been mapped to URLs, all edges have been routed.
 */
export interface DiagramState {
  readonly id: string;

  /** All nodes in render order (back to front for correct transparency sorting) */
  readonly nodes: ReadonlyArray<DiagramNodeState>;

  /** All edges. Rendered before nodes (painter's algorithm) */
  readonly edges: ReadonlyArray<DiagramEdgeState>;

  /** All groups. Rendered before edges (painter's algorithm) */
  readonly groups: ReadonlyArray<DiagramGroupState>;

  /**
   * Computed bounding box of the entire diagram in diagram units.
   * Used by the camera system to auto-frame the diagram if no explicit camera is set.
   */
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly minZ: number;
    readonly maxZ: number;
  };

  /**
   * Suggested camera look-at target in world space [x, y, z].
   * Computed as the diagram bounds center. The consuming scene may override this.
   */
  readonly cameraTarget: readonly [number, number, number];

  /**
   * Suggested camera distance from cameraTarget.
   * Computed from diagram width to ensure all nodes are visible.
   * Based on a 45° vertical FOV: distance = boundsWidth / (2 * tan(22.5°))
   */
  readonly cameraDistance: number;
}

// ─── DSL input types (used by dsl.tsx and consumed by compile.ts) ────────────

/**
 * Raw DSL data extracted from a <DiagramNode> component by the compiler.
 * This is an intermediate type — not part of the public API.
 * All optional fields have defaults applied in compile.ts.
 */
export interface DiagramNodeDSL {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly shape?: DiagramShapeVariant;
  readonly position?: readonly [number, number, number];
  readonly size?: readonly [number, number];
  readonly depth?: number;
  readonly color?: string;
  readonly sideColor?: string;
  readonly borderColor?: string;
  readonly metalness?: number;
  readonly roughness?: number;
  readonly labelColor?: string;
  readonly sublabelColor?: string;
  readonly opacity?: number;
  readonly clickable?: boolean;
  readonly enabled?: boolean;
  readonly iconScale?: number;
  readonly groupId?: string;
}

/** Raw DSL data extracted from a <DiagramEdge> component by the compiler. */
export interface DiagramEdgeDSL {
  /** Optional — compile.ts auto-generates `${from}-${to}-${index}` if omitted. */
  readonly id?: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style?: DiagramEdgeStyle;
  readonly arrowStart?: DiagramArrowVariant;
  readonly arrowEnd?: DiagramArrowVariant;
  readonly color?: string;
  readonly thickness?: number;
  readonly opacity?: number;
}

/** Raw DSL data extracted from a <DiagramGroup> component by the compiler. */
export interface DiagramGroupDSL {
  readonly id: string;
  readonly label: string;
  readonly variant?: DiagramGroupVariant;
  readonly orientation?: DiagramOrientation;
  readonly color?: string;
  readonly borderColor?: string;
  readonly borderStyle?: 'solid' | 'dashed';
  readonly fillOpacity?: number;
  readonly borderOpacity?: number;
  readonly nodeIds: ReadonlyArray<string>;
}

/** Top-level DSL input to compile.ts. Populated by the compiler handler from <Diagram> props. */
export interface DiagramDSL {
  readonly id: string;
  /**
   * Auto-layout algorithm. Sourced from <Diagram layout="..."> prop.
   * Defaults to 'grid' if not provided.
   */
  readonly layout: 'manual' | 'grid' | 'hierarchical';
  /**
   * Node spacing in diagram units [horizontalGap, verticalGap].
   * Sourced from <Diagram layoutSpacing={[2, 2]}> prop.
   * Defaults to [2, 2] if not provided.
   */
  readonly layoutSpacing: readonly [number, number];
  readonly nodes: ReadonlyArray<DiagramNodeDSL>;
  readonly edges: ReadonlyArray<DiagramEdgeDSL>;
  readonly groups: ReadonlyArray<DiagramGroupDSL>;
}

// ─── Interaction ─────────────────────────────────────────────────────────────

/**
 * Emitted when a clickable diagram node is interacted with.
 * v1: dispatched to the scroll advance handler (triggers next scene stop).
 * v2: will carry additional context for free-form interactive exploration.
 */
export interface DiagramInteractionEvent {
  readonly type: 'node-click';
  readonly diagramId: string;
  readonly nodeId: string;
  /** World-space position of the click intersection point */
  readonly intersectPoint: readonly [number, number, number];
}
```

### 4.2 `src/elements/image-panel/types.ts`

```typescript
// src/elements/image-panel/types.ts
// Contract layer for the ImagePanel element. No runtime imports, no Three.js, no React.
// ImagePanel renders a STATIC IMAGE as a physical 3D floating frame.
// Fully WebGL — supports tilt, lighting, and MeshPhysicalMaterial gloss.
// For a live interactive website, use <Screen> instead.

/**
 * Bezel frame style for ImagePanel.
 * Identical to ScreenBezelVariant and BezelVariant in _shared/bezelGeometry.ts —
 * typed separately here to keep element types self-contained (no cross-element imports).
 * If the union ever diverges, update both types independently.
 */
export type ImagePanelBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

/**
 * Fully resolved state for an ImagePanel element.
 * A static image texture displayed on a physical 3D plane with bezel and optional glow.
 * Produced by compileImagePanel() from ImagePanelDSL.
 */
export interface ImagePanelState {
  readonly id: string;

  /**
   * Public asset URL for the image (PNG, JPG, WebP).
   * Loaded via THREE.TextureLoader at render time.
   * Examples: '/screenshots/homepage.png', '/mockups/dashboard.jpg'
   */
  readonly src: string;

  /** World-space position of the panel center [x, y, z] */
  readonly position: readonly [number, number, number];

  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Supports any rotation — this is pure WebGL.
   * A Y tilt of ~0.2 radians gives a natural perspective feel.
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale applied to both panel and bezel. Default: 1 */
  readonly scale: number;

  /**
   * Panel display width in world units. Default: 12
   * Height is derived from the image's aspect ratio unless `height` is also provided.
   */
  readonly width: number;

  /**
   * Explicit panel height override in world units.
   * If undefined, height = width / imageAspectRatio (computed after texture loads).
   * Provide this when the aspect ratio is known at author time to avoid layout shift.
   */
  readonly height: number | undefined;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: ImagePanelBezelVariant;

  /**
   * Bezel border thickness in world units.
   * Default: 0.15 ('thin'), 0.35 ('dark' | 'light' | 'chrome'), 0 ('none').
   */
  readonly bezelThickness: number;

  /** Overall panel + bezel opacity [0–1]. Default: 1 */
  readonly opacity: number;

  /**
   * Screen surface gloss [0–1].
   * Implemented as THREE.MeshPhysicalMaterial clearcoat.
   * 0 = matte, 1 = mirror-like. Recommended: 0.4–0.7 for realistic screen appearance.
   * Default: 0.5
   */
  readonly gloss: number;

  /**
   * Clearcoat roughness [0–1]. Lower = sharper reflections.
   * Default: 0.05 (near-mirror clearcoat surface).
   */
  readonly glossRoughness: number;

  /**
   * Faint emissive self-illumination to simulate a lit screen.
   * Applied as MeshPhysicalMaterial.emissiveIntensity. Default: 0.15
   * Set to 0 for a non-illuminated image (e.g., a photograph, not a screen).
   */
  readonly selfIllumination: number;

  /**
   * Whether to render a glow halo around the panel edges.
   * Implemented as a THREE.Sprite with additive blending.
   * Default: true
   */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' (cool blue-white for screen look) */
  readonly glowColor: string;

  /**
   * Glow size multiplier relative to panel size (1.0 = panel size).
   * Default: 1.4 — glow bleeds 40% beyond the panel edges.
   */
  readonly glowScale: number;

  /** Glow sprite opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /** Whether the panel is rendered. Allows hide/show via scene transitions. Default: true */
  readonly enabled: boolean;
}

/** Raw DSL props from <ImagePanel> before compile.ts applies defaults. */
export interface ImagePanelDSL {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ImagePanelBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly gloss?: number;
  readonly glossRoughness?: number;
  readonly selfIllumination?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
```

### 4.3 `src/elements/screen/types.ts`

```typescript
// src/elements/screen/types.ts
// Contract layer for the Screen element. No runtime imports, no Three.js, no React.
// Screen renders a LIVE INTERACTIVE WEBSITE via a DOM <iframe> overlaid on the WebGL canvas.
// The iframe is projected to screen-space every frame to align with the WebGL bezel.
// Does NOT support significant tilt — the iframe is always a flat 2D rectangle.
// For a static image displayed in 3D, use <ImagePanel> instead.

/**
 * Bezel frame style for the Screen element.
 * Identical union to ImagePanelBezelVariant and BezelVariant in _shared/bezelGeometry.ts.
 * Typed separately here to keep screen/types.ts self-contained (no cross-element imports).
 */
export type ScreenBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

/**
 * Fully resolved state for a Screen element.
 * The WebGL bezel and glow are driven by this state.
 * The iframe src is driven by this state.
 * Produced by compileScreen() from ScreenDSL.
 */
export interface ScreenState {
  readonly id: string;

  /**
   * URL for the iframe src attribute.
   * Must be a URL that does not send X-Frame-Options: DENY or
   * Content-Security-Policy: frame-ancestors 'none'.
   * Best used with your own product URLs or localhost dev servers.
   */
  readonly src: string;

  /** World-space position of the screen center [x, y, z]. Default: [0, 0, 0] */
  readonly position: readonly [number, number, number];

  /**
   * World-space rotation in radians [x, y, z].
   * IMPORTANT: The iframe is a flat 2D DOM rectangle. Rotation values above ~0.1
   * radians on any axis will cause the iframe to visibly misalign with the bezel.
   * compile.ts emits a console.warn if |rotation[i]| > 0.15 for any axis.
   * For tilted image content, use <ImagePanel> instead.
   * Default: [0, 0, 0]
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale. Applied to the WebGL bezel and to the iframe CSS dimensions. */
  readonly scale: number;

  /**
   * Screen content width in world units.
   * The iframe CSS width is derived from this via the camera projection.
   * Default: 12
   */
  readonly width: number;

  /**
   * Screen content height in world units.
   * The iframe CSS height is derived from this via the camera projection.
   * Default: 7.5 (16:9 aspect ratio at default width of 12)
   */
  readonly height: number;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: ScreenBezelVariant;

  /**
   * Bezel border thickness in world units.
   * Default: 0.3
   */
  readonly bezelThickness: number;

  /**
   * Opacity for the WebGL bezel and glow [0–1].
   * Also applied as CSS opacity to the iframe div — both fade together.
   * Default: 1
   */
  readonly opacity: number;

  /**
   * Whether to render a glow halo around the bezel.
   * Same implementation as ImagePanel (shared glowSprite utility).
   * Default: true
   */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' */
  readonly glowColor: string;

  /** Glow size multiplier relative to screen size. Default: 1.4 */
  readonly glowScale: number;

  /** Glow sprite opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /**
   * Whether the screen is active. When false:
   * - WebGL bezel and glow are hidden
   * - iframe div is display:none (src does not load)
   * Default: true
   */
  readonly enabled: boolean;
}

/** Raw DSL props from <Screen> before compile.ts applies defaults. */
export interface ScreenDSL {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ScreenBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
```

> **Notice:** `ScreenState` has no `gloss` or `selfIllumination` fields. The iframe content
> is not a WebGL texture — there is no plane mesh to apply `MeshPhysicalMaterial` to.
> The bezel has its own material (dark/chrome/etc.) but the screen interior is transparent
> in WebGL, exposing the DOM iframe beneath. `ImagePanel` has both because its content is
> a real Three.js material surface.

---

## 5. `dsl.tsx` — DSL Components

### 5.1 `src/elements/diagram/dsl.tsx`

DSL components return `null` — they exist only to be parsed by the compiler registry.
They use React context to register themselves with the parent `<Diagram>` collector.

```typescript
// src/elements/diagram/dsl.tsx
// Declarative DSL surface for diagram authoring. No Three.js. No compiler internals.

import React from 'react';
import type {
  DiagramShapeVariant,
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramGroupVariant,
  DiagramOrientation,
} from './types.ts';

// ─── <DiagramNode> ────────────────────────────────────────────────────────────

export interface DiagramNodeProps {
  /** Unique ID within the diagram */
  id: string;
  /** Primary label text */
  label: string;
  /** Secondary label text below primary */
  sublabel?: string;
  /**
   * Shape variant. Determines both geometry type and icon asset.
   * Defaults to 'flow:rect'.
   */
  shape?: DiagramShapeVariant;
  /**
   * World-space position [x, y, z].
   * z controls depth — use for drill-down animations.
   * If omitted, auto-layout assigns a position based on declaration order.
   */
  position?: [number, number, number];
  /** Node width and height in diagram units. Default: [4, 2] */
  size?: [number, number];
  /** Physical box depth. Default: 0.4 */
  depth?: number;
  /** Face color (CSS hex). Default: '#2a2d3e' (dark slate) */
  color?: string;
  /** Side/edge color (CSS hex). Default: derives from color (darker) */
  sideColor?: string;
  /** Border outline color (CSS hex). Default: derives from color (lighter) */
  borderColor?: string;
  /** Surface metalness [0–1]. Default: 0.15 */
  metalness?: number;
  /** Surface roughness [0–1]. Default: 0.65 */
  roughness?: number;
  /** Label text color (CSS hex). Default: '#ffffff' */
  labelColor?: string;
  /** Sublabel text color (CSS hex). Default: '#a0a8c0' */
  sublabelColor?: string;
  /** Node opacity [0–1]. Default: 1 */
  opacity?: number;
  /** Whether node responds to click/raycast. Default: false */
  clickable?: boolean;
  /** Whether node is rendered. Default: true */
  enabled?: boolean;
  /** Icon scale relative to node face [0–1]. Default: 0.6 */
  iconScale?: number;
}

/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 */
export function DiagramNode(_props: DiagramNodeProps): null {
  return null;
}

// ─── <DiagramEdge> ────────────────────────────────────────────────────────────

export interface DiagramEdgeProps {
  /** Unique ID within the diagram */
  id?: string;
  /** ID of the source node */
  from: string;
  /** ID of the destination node */
  to: string;
  /** Label displayed at edge midpoint */
  label?: string;
  /** Line visual style. Default: 'solid' */
  style?: DiagramEdgeStyle;
  /** Arrowhead at source end. Default: 'none' */
  arrowStart?: DiagramArrowVariant;
  /** Arrowhead at destination end. Default: 'open' */
  arrowEnd?: DiagramArrowVariant;
  /** Edge color (CSS hex). Default: '#555e7a' */
  color?: string;
  /** Tube radius in diagram units. Default: 0.04 */
  thickness?: number;
  /** Edge opacity [0–1]. Default: 1 */
  opacity?: number;
}

/**
 * Declares a directed connector between two diagram nodes.
 * Must be a direct or indirect child of <Diagram>.
 */
export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

// ─── <DiagramGroup> ───────────────────────────────────────────────────────────

export interface DiagramGroupProps {
  /** Unique ID within the diagram */
  id: string;
  /** Group header label */
  label: string;
  /** Group visual variant. Default: 'boundary' */
  variant?: DiagramGroupVariant;
  /** Swimlane orientation (only for variant='swimlane'). Default: 'vertical' */
  orientation?: DiagramOrientation;
  /** Fill color (CSS hex). Default: '#1a1d2e' */
  color?: string;
  /** Border color (CSS hex). Default: '#3a4060' */
  borderColor?: string;
  /** Border line style. Default: 'solid' */
  borderStyle?: 'solid' | 'dashed';
  /** Fill opacity [0–1]. Default: 0.08 */
  fillOpacity?: number;
  /** Border opacity [0–1]. Default: 0.6 */
  borderOpacity?: number;
  /**
   * Child <DiagramNode> elements that belong to this group.
   * Group bounds are computed from the union of child node positions + sizes.
   */
  children?: React.ReactNode;
}

/**
 * Declares a visual grouping container (swimlane, boundary, or cluster).
 * Direct children that are <DiagramNode> elements are assigned to this group.
 */
export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

// ─── <Diagram> ────────────────────────────────────────────────────────────────

export interface DiagramProps {
  /** Unique diagram ID. Must be stable across scenes. */
  id: string;
  /**
   * Auto-layout algorithm to apply when node positions are not explicitly set.
   * 'manual' — uses only explicitly provided positions; throws if any node has no position.
   * 'grid'   — arranges nodes in a left-to-right, top-to-bottom grid.
   * 'hierarchical' — arranges nodes by dependency (edges define parent-child).
   * Default: 'grid'
   */
  layout?: 'manual' | 'grid' | 'hierarchical';
  /**
   * Spacing between nodes in diagram units when using auto-layout.
   * Default: [2, 2] (2 units horizontal, 2 units vertical gap)
   */
  layoutSpacing?: [number, number];
  children?: React.ReactNode;
}

/**
 * Root container for a 3D diagram declaration.
 * All <DiagramNode>, <DiagramEdge>, and <DiagramGroup> elements must be
 * descendants of <Diagram>.
 */
export function Diagram(_props: DiagramProps): null {
  return null;
}
```

### 5.2 `src/elements/image-panel/dsl.tsx`

```typescript
// src/elements/image-panel/dsl.tsx
// Declarative DSL for the ImagePanel element. No Three.js. No compiler internals.
// Use <ImagePanel> for static images (screenshots, mockups, photographs).
// For live interactive websites, use <Screen>.

import type { ImagePanelBezelVariant } from './types.ts';

export interface ImagePanelProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /** Public asset URL for the image. E.g. '/screenshots/homepage.png' */
  src: string;
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /**
   * World-space rotation in radians [x, y, z].
   * Fully supported — this is pure WebGL. Tilt freely.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Panel width in world units. Default: 12 */
  width?: number;
  /** Panel height in world units. Computed from image aspect ratio if omitted. */
  height?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ImagePanelBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Overall opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Surface gloss (MeshPhysicalMaterial clearcoat) [0–1].
   * Makes the image surface look like a real screen or photograph.
   * Default: 0.5
   */
  gloss?: number;
  /**
   * Clearcoat roughness [0–1]. Lower = sharper specular reflections.
   * Default: 0.05
   */
  glossRoughness?: number;
  /**
   * Faint self-illumination to simulate a lit screen [0–1].
   * Set to 0 for photographs/prints; keep at default for screen mockups.
   * Default: 0.15
   */
  selfIllumination?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to panel size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. Default: true */
  enabled?: boolean;
}

/**
 * Renders a static image as a physical 3D floating panel in world space.
 * The image is a WebGL texture — fully supports tilt, lighting, and reflections.
 * For a live interactive website, use <Screen>.
 */
export function ImagePanel(_props: ImagePanelProps): null {
  return null;
}
```

### 5.3 `src/elements/screen/dsl.tsx`

```typescript
// src/elements/screen/dsl.tsx
// Declarative DSL for the Screen element. No Three.js. No compiler internals.
// Use <Screen> for live interactive websites rendered via a DOM <iframe>.
// For static images, use <ImagePanel>.

import type { ScreenBezelVariant } from './types.ts';

export interface ScreenProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /**
   * The URL to load in the iframe.
   * Must not have X-Frame-Options: DENY set on the target server.
   * Best for your own apps, localhost, or iframe-friendly sites.
   */
  src: string;
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /**
   * World-space rotation in radians [x, y, z].
   * Keep near [0, 0, 0] — the iframe is a flat DOM rect and cannot tilt.
   * Values above ~0.1 rad will visibly misalign the iframe with the bezel.
   * compile.ts emits console.warn if |rotation[i]| > 0.15.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Screen content width in world units. Default: 12 */
  width?: number;
  /** Screen content height in world units. Default: 7.5 (16:9 at width 12) */
  height?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ScreenBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Opacity for bezel, glow, and iframe div [0–1]. Default: 1 */
  opacity?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to screen size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. When false, iframe is display:none. Default: true */
  enabled?: boolean;
}

/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * The website is a real <iframe> — click, scroll, and interact normally.
 * The bezel and glow are WebGL objects that track the screen position.
 * The 3D scene renders behind the screen. The iframe faces the camera.
 * For a static image, use <ImagePanel> instead.
 */
export function Screen(_props: ScreenProps): null {
  return null;
}
```

---

## 6. `compile.ts` — Pure Compilation Functions

### 6.1 `src/elements/diagram/compile.ts`

All functions are pure (no side effects, no I/O). Inputs are DSL types. Outputs are state
types. No Three.js. No React. Fully unit-testable with plain inputs.

```typescript
// src/elements/diagram/compile.ts
// Pure transformation pipeline: DiagramDSL → DiagramState.
// No Three.js. No React. No side effects.

import type {
  DiagramDSL, DiagramState,
  DiagramNodeDSL, DiagramNodeState,
  DiagramEdgeDSL, DiagramEdgeState,
  DiagramGroupDSL, DiagramGroupState,
} from './types.ts';
import { resolveIconUrl } from './shapes/iconRegistry.ts';
import { deriveColor }   from './math/colorUtils.ts';
// deriveColor(hex, delta) — pure hex color manipulation, spec in Section 10.2
// delta > 0 = lighten, delta < 0 = darken. Used for sideColor and borderColor defaults.

// ─── Defaults ────────────────────────────────────────────────────────────────

// NOTE: sideColor and borderColor are NOT in NODE_DEFAULTS because they are
// derived from `color` at compile time using deriveColor(). If the author
// provides explicit sideColor/borderColor, those values are used directly.
// If not, compileNode() calls deriveColor(dsl.color, -0.15) for sideColor
// and deriveColor(dsl.color, +0.25) for borderColor.
const DEFAULT_COLOR = '#2a2d3e';
const NODE_DEFAULTS = {
  shape:         'flow:rect' as const,
  size:          [4, 2] as [number, number],
  depth:         0.4,
  color:         DEFAULT_COLOR,
  // sideColor:  derived from color — see compileNode()
  // borderColor: derived from color — see compileNode()
  metalness:     0.15,
  roughness:     0.65,
  labelColor:    '#ffffff',
  sublabelColor: '#a0a8c0',
  opacity:       1,
  clickable:     false,
  enabled:       true,
  iconScale:     0.6,
};

const EDGE_DEFAULTS = {
  style: 'solid' as const,
  arrowStart: 'none' as const,
  arrowEnd: 'open' as const,
  color: '#555e7a',
  thickness: 0.04,
  opacity: 1,
};

const GROUP_DEFAULTS = {
  variant: 'boundary' as const,
  orientation: 'vertical' as const,
  color: '#1a1d2e',
  borderColor: '#3a4060',
  borderStyle: 'solid' as const,
  fillOpacity: 0.08,
  borderOpacity: 0.6,
};

const GROUP_PADDING = 1.5; // diagram units — space around node bounds within a group

// ─── Layout Algorithms ───────────────────────────────────────────────────────

/**
 * Assigns [x, y, z] positions to nodes that have no explicit position.
 * For the 'grid' layout, places nodes left-to-right in rows of ~4 nodes.
 * For the 'hierarchical' layout, performs a topological sort on edges and assigns
 * depth levels as Y-axis bands.
 * For 'manual', all nodes must have explicit positions — throws on missing position.
 *
 * @param nodes  - Raw DSL nodes
 * @param edges  - Raw DSL edges (used by 'hierarchical' for parent-child ordering)
 * @param layout - Layout algorithm
 * @param spacing - [horizontalGap, verticalGap] in diagram units
 * @returns Map from node id to resolved [x, y, z]
 */
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
): Map<string, readonly [number, number, number]>;

/**
 * Computes the bounding box of a set of nodes (resolved positions + sizes).
 * Used by compileDiagram for the overall bounds and by compileGroup for group bounds.
 *
 * @param nodeIds - IDs of nodes to include in bounds calculation
 * @param positions - Resolved position map from resolveLayout
 * @param sizes - Map from node id to [width, height]
 * @returns Axis-aligned bounding box {x, y, w, h, minZ, maxZ}
 */
export function computeBounds(
  nodeIds: ReadonlyArray<string>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
): { x: number; y: number; w: number; h: number; minZ: number; maxZ: number };

// ─── Edge Routing ─────────────────────────────────────────────────────────────

/**
 * Routes edges between node face centers, computing Bezier-style control points.
 *
 * Algorithm:
 * 1. Find the nearest face center on each endpoint node (the face whose outward normal
 *    most closely points toward the other node — avoids routing through node interiors).
 * 2. Offset the start/end points by a small amount (0.1 units) along the face normal
 *    to prevent Z-fighting with the node face mesh.
 * 3. Add a single mid-point control point perpendicular to the direct line, biased
 *    slightly toward the higher-Y node (upward curve convention for top-down diagrams).
 * 4. For edges in the same Y band (near-horizontal), the mid-point is offset in Z
 *    instead of Y to avoid routing through node geometry.
 *
 * @param edges     - Raw DSL edges
 * @param positions - Resolved position map
 * @param sizes     - Resolved size map (including depth as third dimension)
 * @returns Map from edge id to computed control points array
 */
export function routeEdges(
  edges: ReadonlyArray<DiagramEdgeDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number, number]>, // [w, h, depth]
): Map<string, ReadonlyArray<readonly [number, number, number]>>;

// ─── Node / Edge / Group Compilation ─────────────────────────────────────────

/**
 * Compiles a single node DSL into a fully resolved DiagramNodeState.
 * Applies defaults, resolves icon URL, and assigns groupId from parent group.
 *
 * sideColor and borderColor derivation:
 *   - If dsl.sideColor is provided: use it directly
 *   - If not: sideColor = deriveColor(resolvedColor, -0.15)  (15% darker)
 *   - If dsl.borderColor is provided: use it directly
 *   - If not: borderColor = deriveColor(resolvedColor, +0.25) (25% lighter)
 *
 * iconUrl resolution:
 *   iconUrl = resolveIconUrl(resolvedShape) — may be undefined for geometry-only shapes
 */
export function compileNode(
  dsl: DiagramNodeDSL,
  position: readonly [number, number, number],
  groupId: string | undefined,
): DiagramNodeState;

/**
 * Compiles a single edge DSL into a DiagramEdgeState.
 * Applies defaults and attaches computed control points.
 * Auto-generates an id from `${from}-${to}` if not provided.
 */
export function compileEdge(
  dsl: DiagramEdgeDSL,
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
  index: number,
): DiagramEdgeState;

/**
 * Compiles a single group DSL into a DiagramGroupState.
 * Computes bounds from the union of all member node positions + sizes + padding.
 */
export function compileGroup(
  dsl: DiagramGroupDSL,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
): DiagramGroupState;

// ─── Top-Level Compilation ────────────────────────────────────────────────────

/**
 * Full diagram compilation pipeline. Called by the compiler registry handler.
 *
 * Execution order:
 * 1. Extract group membership (which nodes belong to which group)
 * 2. resolveLayout — assigns positions to nodes without explicit position
 * 3. routeEdges — computes control points for all edges
 * 4. compileNode for each node (with position and groupId)
 * 5. compileEdge for each edge (with control points)
 * 6. compileGroup for each group (with resolved positions)
 * 7. computeBounds for the full diagram
 * 8. Compute cameraTarget and cameraDistance from bounds
 *
 * @param dsl - The raw DiagramDSL extracted from the scene JSX
 * @returns Fully resolved DiagramState ready for render.ts
 */
export function compileDiagram(dsl: DiagramDSL): DiagramState;

// ─── Functional Transition Spec ───────────────────────────────────────────────
// Import blend helpers from @brewsite/core (same package that provides FunctionalTransitionSpec).
// These are pure functions — no Three.js, no React. Safe in compile.ts.
//
// import type { FunctionalTransitionSpec } from '@brewsite/core';
// import { blendNumber, blendVec3, blendOpacity } from '@brewsite/core';

/**
 * Functional transition spec for DiagramState.
 * Used by DiagramWidget as its transitionSpec — evaluated by the runtime at
 * tick.blockProgress for infinite easing fidelity with no oversampling overhead.
 *
 * INTERPOLATE: Blends each node's [x,y,z] position and opacity across the block.
 * This is what produces the smooth Z-depth reveal as nodes move from z=0 to their
 * drill-down positions. Nodes/edges present in only one state fade in or out.
 *
 * EXIT/ENTER: Fade entire diagram to/from opacity 0 over the half-block.
 *
 * Key constraint: node and edge arrays may differ in length between fromState/toState.
 * Match nodes by id. Nodes present in toState but not fromState appear (fade in).
 * Nodes present in fromState but not toState disappear (fade out).
 */
export const functionalDiagramTransitionSpec: FunctionalTransitionSpec<DiagramState> = {
  exitFn: (from) => (t) => ({
    ...from,
    nodes: from.nodes.map(n => ({ ...n, opacity: blendOpacity(n.opacity, 0, t) })),
    edges: from.edges.map(e => ({ ...e, opacity: blendOpacity(e.opacity, 0, t) })),
  }),
  enterFn: (to) => (t) => ({
    ...to,
    nodes: to.nodes.map(n => ({ ...n, opacity: blendOpacity(0, n.opacity, t) })),
    edges: to.edges.map(e => ({ ...e, opacity: blendOpacity(0, e.opacity, t) })),
  }),
  interpolateFn: (from, to) => (t) => {
    // Build a lookup map from fromState nodes/edges for O(1) match by id
    const fromNodeMap = new Map(from.nodes.map(n => [n.id, n]));
    const fromEdgeMap = new Map(from.edges.map(e => [e.id, e]));

    return {
      ...to,                                         // use toState's structural data (ids, labels, etc.)
      cameraTarget:   blendVec3(from.cameraTarget,   to.cameraTarget,   t),
      cameraDistance: blendNumber(from.cameraDistance, to.cameraDistance, t),
      nodes: to.nodes.map(toNode => {
        const fromNode = fromNodeMap.get(toNode.id);
        if (!fromNode) {
          // Node only in toState: fade in over full block
          return { ...toNode, opacity: blendOpacity(0, toNode.opacity, t) };
        }
        return {
          ...toNode,
          position: blendVec3(fromNode.position, toNode.position, t),
          opacity:  blendOpacity(fromNode.opacity, toNode.opacity, t),
        };
      }),
      edges: to.edges.map(toEdge => {
        const fromEdge = fromEdgeMap.get(toEdge.id);
        if (!fromEdge) {
          return { ...toEdge, opacity: blendOpacity(0, toEdge.opacity, t) };
        }
        return {
          ...toEdge,
          opacity: blendOpacity(fromEdge.opacity, toEdge.opacity, t),
          // Animate control points — this is what makes edge tubes glide between positions
          controlPoints: toEdge.controlPoints.map((pt, i) => {
            const fp = fromEdge.controlPoints[i] ?? pt;
            return blendVec3(fp, pt, t);
          }),
        };
      }),
    };
  },
};
```

### 6.2 `src/elements/image-panel/compile.ts`

```typescript
// src/elements/image-panel/compile.ts
// Pure compilation for ImagePanel element: ImagePanelDSL → ImagePanelState.
// No Three.js. No React. No side effects.

import type { ImagePanelDSL, ImagePanelState } from './types.ts';

/**
 * Compiles an ImagePanelDSL into a fully resolved ImagePanelState by applying defaults.
 * All fields in the output are defined — no undefined values.
 *
 * Defaults applied:
 *   position:        [0, 0, 0]
 *   rotation:        [0, 0, 0]
 *   scale:           1
 *   width:           12
 *   height:          undefined (computed from image aspect ratio at render time)
 *   bezel:           'dark'
 *   bezelThickness:  0.3
 *   opacity:         1
 *   gloss:           0.5
 *   glossRoughness:  0.05
 *   selfIllumination: 0.15
 *   glow:            true
 *   glowColor:       '#88ccff'
 *   glowScale:       1.4
 *   glowOpacity:     0.35
 *   enabled:         true
 */
export function compileImagePanel(dsl: ImagePanelDSL): ImagePanelState;

// import type { FunctionalTransitionSpec } from '@brewsite/core';
// import { blendNumber, blendVec3, blendOpacity } from '@brewsite/core';

/**
 * Functional transition spec for ImagePanelState.
 * Position, rotation, scale, and opacity are all continuously interpolated.
 * Discrete properties (src, bezel, gloss) step at t=0.5 — you cannot meaningfully
 * interpolate an image URL or a bezel material variant.
 */
export const functionalImagePanelTransitionSpec: FunctionalTransitionSpec<ImagePanelState> = {
  exitFn: (from) => (t) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, t),
  }),
  enterFn: (to) => (t) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, t),
  }),
  interpolateFn: (from, to) => (t) => ({
    ...to,
    position:        blendVec3(from.position, to.position, t),
    rotation:        blendVec3(from.rotation, to.rotation, t),
    scale:           blendNumber(from.scale, to.scale, t),
    opacity:         blendOpacity(from.opacity, to.opacity, t),
    gloss:           blendNumber(from.gloss, to.gloss, t),
    selfIllumination: blendNumber(from.selfIllumination, to.selfIllumination, t),
    glowOpacity:     blendNumber(from.glowOpacity, to.glowOpacity, t),
    // Discrete properties: step at midpoint
    src:   t < 0.5 ? from.src   : to.src,
    bezel: t < 0.5 ? from.bezel : to.bezel,
    glow:  t < 0.5 ? from.glow  : to.glow,
  }),
};
```

### 6.3 `src/elements/screen/compile.ts`

```typescript
// src/elements/screen/compile.ts
// Pure compilation for Screen element: ScreenDSL → ScreenState.
// No Three.js. No React. No DOM access.

import type { ScreenDSL, ScreenState } from './types.ts';

/**
 * Compiles a ScreenDSL into a fully resolved ScreenState by applying defaults.
 * All fields in the output are defined — no undefined values.
 *
 * Side effect: emits console.warn if any rotation axis exceeds 0.15 radians,
 * because the iframe overlay cannot meaningfully tilt with the WebGL bezel.
 *
 * Defaults applied:
 *   position:        [0, 0, 0]
 *   rotation:        [0, 0, 0]
 *   scale:           1
 *   width:           12
 *   height:          7.5  (16:9 aspect ratio)
 *   bezel:           'dark'
 *   bezelThickness:  0.3
 *   opacity:         1
 *   glow:            true
 *   glowColor:       '#88ccff'
 *   glowScale:       1.4
 *   glowOpacity:     0.35
 *   enabled:         true
 */
export function compileScreen(dsl: ScreenDSL): ScreenState;

// import type { FunctionalTransitionSpec } from '@brewsite/core';
// import { blendNumber, blendVec3, blendOpacity } from '@brewsite/core';

/**
 * Functional transition spec for ScreenState.
 * Position, scale, and opacity are continuously interpolated (opacity drives both
 * the WebGL bezel and the iframe CSS opacity simultaneously).
 * src and bezel step at t=0.5 — URLs and variants cannot be interpolated.
 *
 * Note: height and width are not interpolated (no smooth resize of the iframe).
 * They step at t=0.5. To animate a resize, change only position/scale.
 */
export const functionalScreenTransitionSpec: FunctionalTransitionSpec<ScreenState> = {
  exitFn: (from) => (t) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, t),
  }),
  enterFn: (to) => (t) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, t),
  }),
  interpolateFn: (from, to) => (t) => ({
    ...to,
    position:    blendVec3(from.position, to.position, t),
    rotation:    blendVec3(from.rotation, to.rotation, t),
    scale:       blendNumber(from.scale, to.scale, t),
    opacity:     blendOpacity(from.opacity, to.opacity, t),
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, t),
    // Discrete properties: step at midpoint
    src:    t < 0.5 ? from.src    : to.src,
    bezel:  t < 0.5 ? from.bezel  : to.bezel,
    width:  t < 0.5 ? from.width  : to.width,
    height: t < 0.5 ? from.height : to.height,
  }),
};
```

### 6.4 Widget Classes — `widget.ts` for Each Element

Each element needs a **Widget class** that implements `ISceneElement<TState>` from `@brewsite/core`.
This is the integration point between the compile layer (functional spec) and the render layer
(Three.js renderer). It cannot live in `render.ts` (no React allowed there) or `index.ts`
(re-exports only), so each element gets a dedicated `widget.ts`.

The Widget class is what the consuming app registers with `WidgetRegistry`. The runtime then
calls `widget.apply(state)` each tick with either the pre-baked discrete state or the
functional closure result from `tick.transitionBlocks`.

**`src/elements/diagram/widget.ts`**

```typescript
// src/elements/diagram/widget.ts
// DiagramWidget — implements ISceneElement<DiagramState>.
// Wires together: DSL component, functional transition spec, and Three.js renderer.
// This is the only file in the diagram element that may import from all three tiers
// (dsl.tsx for DslComponent, compile.ts for transitionSpec, render.ts for rendering).

import type { ISceneElement } from '@brewsite/core';
import { Diagram } from './dsl.tsx';
import { functionalDiagramTransitionSpec } from './compile.ts';
import { DiagramRenderer } from './render.ts';
import type { DiagramState } from './types.ts';
import type * as THREE from 'three';

export class DiagramWidget implements ISceneElement<DiagramState> {
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;

  private renderer = new DiagramRenderer();

  /**
   * @param widgetId - Must match the id prop used in <Diagram id="..."> DSL declarations
   *                   and the setWidgetState() call in handlers.ts.
   */
  constructor(widgetId: string, defaultState: DiagramState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  apply(state: DiagramState, scene: THREE.Scene): void {
    this.renderer.update(state, scene);
  }

  dispose(scene: THREE.Scene): void {
    this.renderer.dispose(this.widgetId, scene);
  }
}
```

**`src/elements/image-panel/widget.ts`**

```typescript
// src/elements/image-panel/widget.ts
// ImagePanelWidget — implements ISceneElement<ImagePanelState>.

import type { ISceneElement } from '@brewsite/core';
import { ImagePanel } from './dsl.tsx';
import { functionalImagePanelTransitionSpec } from './compile.ts';
import { ImagePanelRenderer } from './render.ts';
import type { ImagePanelState } from './types.ts';
import type * as THREE from 'three';

export class ImagePanelWidget implements ISceneElement<ImagePanelState> {
  readonly widgetId: string;
  readonly defaultState: ImagePanelState;
  readonly transitionSpec = functionalImagePanelTransitionSpec;
  readonly DslComponent = ImagePanel;

  private renderer = new ImagePanelRenderer();

  constructor(widgetId: string, defaultState: ImagePanelState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  apply(state: ImagePanelState, scene: THREE.Scene): void {
    this.renderer.update(state, scene);
  }

  dispose(scene: THREE.Scene): void {
    this.renderer.dispose(this.widgetId, scene);
  }
}
```

**`src/elements/screen/widget.ts`**

```typescript
// src/elements/screen/widget.ts
// ScreenWidget — implements ISceneElement<ScreenState>.
// Note: ScreenRenderer requires camera and canvasRect in addition to scene.
// These are provided via a separate setRenderContext() call before each apply().

import type { ISceneElement } from '@brewsite/core';
import { Screen } from './dsl.tsx';
import { functionalScreenTransitionSpec } from './compile.ts';
import { ScreenRenderer } from './render.ts';
import type { ScreenState } from './types.ts';
import type * as THREE from 'three';

export class ScreenWidget implements ISceneElement<ScreenState> {
  readonly widgetId: string;
  readonly defaultState: ScreenState;
  readonly transitionSpec = functionalScreenTransitionSpec;
  readonly DslComponent = Screen;

  private renderer: ScreenRenderer;

  constructor(widgetId: string, defaultState: ScreenState, overlayContainer: HTMLDivElement) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
    this.renderer = new ScreenRenderer(overlayContainer);
  }

  /**
   * Must be called before apply() each frame to provide camera and canvas rect.
   * The engine integration layer (RuntimeDriver or equivalent) is responsible for
   * calling this with the current frame's camera and canvas bounding rect.
   */
  setRenderContext(camera: THREE.Camera, canvasRect: DOMRect): void {
    this._camera = camera;
    this._canvasRect = canvasRect;
  }
  private _camera: THREE.Camera | null = null;
  private _canvasRect: DOMRect | null = null;

  apply(state: ScreenState, scene: THREE.Scene): void {
    if (!this._camera || !this._canvasRect) {
      console.warn(`ScreenWidget(${this.widgetId}): setRenderContext() not called before apply()`);
      return;
    }
    this.renderer.update(state, scene, this._camera, this._canvasRect);
  }

  dispose(scene: THREE.Scene): void {
    this.renderer.dispose(this.widgetId, scene);
  }
}
```

> **On `ISceneElement`:** Verify the exact interface signature by reading
> `packages/core/src/widget/types.ts` before implementing. The `apply()` method
> signature may differ (e.g., it may receive a `RenderContext` object instead of
> `THREE.Scene` directly). Adjust the widget classes to match the actual interface.

---

## 7. `render.ts` — Three.js Rendering + DOM Overlay

### 7.1 `src/elements/diagram/render.ts` — Approach Description

> **render.ts is intentionally not quoted as TypeScript here** — its full implementation
> depends on Three.js version-specific APIs. The following is a complete behavioral
> specification that implementation must satisfy.

**Node Rendering — Physical Box (Option B)**

Each `DiagramNodeState` is rendered as a group of Three.js objects:

```
DiagramNodeGroup (THREE.Group)
  ├── boxMesh          THREE.Mesh(BoxGeometry, MeshStandardMaterial[])
  ├── iconPlane        THREE.Mesh(PlaneGeometry, MeshStandardMaterial) [optional, if iconUrl set]
  ├── labelText        troika-three-text Text object (front face label)
  ├── sublabelText     troika-three-text Text object [optional]
  └── borderLines      THREE.LineSegments(EdgesGeometry, LineBasicMaterial)
```

**`boxMesh` material setup:**
- Use `THREE.MeshStandardMaterial[]` — an array of 6 materials (one per face):
  - Face 0 (right): sideColor material
  - Face 1 (left): sideColor material
  - Face 2 (top): sideColor material (slightly lighter via `emissive`)
  - Face 3 (bottom): sideColor material (slightly darker)
  - Face 4 (front): color material — this is the display face
  - Face 5 (back): sideColor material (usually invisible)
- Front face material: `metalness: state.metalness, roughness: state.roughness`
- `transparent: true, opacity: state.opacity` on all materials
- `side: THREE.FrontSide` (backface culling — nodes are opaque boxes)

**`iconPlane` setup (when `state.iconUrl` is defined):**
- `PlaneGeometry(iconWidth, iconHeight)` where dimensions = node face × iconScale
- Positioned at the upper portion of the front face, Z-offset: `depth/2 + 0.01` (just above face)
- Uses `THREE.TextureLoader` for PNG icons, `THREE.SVGLoader` for SVG icons
- SVG rendering: parse SVG paths into `THREE.ShapePath[]`, extrude to `ExtrudeGeometry`
  with depth 0 (flat), or use SVGLoader's built-in shape-to-path approach for 2D overlay
- Material: `MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })`

**`labelText` setup (troika-three-text):**
- `new Text()` from `troika-three-text`
- Position: front face center, Z-offset `depth/2 + 0.02`
- `text`, `fontSize`, `color: state.labelColor`
- `anchorX: 'center', anchorY: 'middle'`
- `maxWidth: state.size[0] * 0.85` (85% of node width — leave margin)
- When icon is present: shift label toward bottom third of node face
- `sync()` must be called after properties are set — this is async; track with a promise

**`borderLines` setup:**
- `new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d))`
- `new THREE.LineBasicMaterial({ color: state.borderColor, opacity: 0.8, transparent: true })`
- Gives a crisp wireframe outline that emphasizes node edges under lighting

**Edge Rendering — 3D Tubes**

Each `DiagramEdgeState` is rendered as:

```
DiagramEdgeGroup (THREE.Group)
  ├── tube      THREE.Mesh(TubeGeometry, MeshStandardMaterial)
  ├── arrowEnd  THREE.Mesh(ConeGeometry, MeshStandardMaterial)  [if arrowEnd !== 'none']
  └── arrowStart THREE.Mesh(ConeGeometry, MeshStandardMaterial) [if arrowStart !== 'none']
```

- `new THREE.CatmullRomCurve3(controlPoints)` — smooth curve through the routed points
- `new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)`:
  - `tubularSegments`: `Math.max(20, controlPoints.length * 8)` for smooth curves
  - `radius`: `state.thickness`
  - `radialSegments`: 8 (sufficient for small tubes)
- `MeshStandardMaterial({ color: state.color, metalness: 0.3, roughness: 0.7 })`
- For `style: 'dashed'`: No native tube dashing in Three.js. Use a custom `dashOffset`
  material approach: tile a 1×1 texture with alternating transparent/opaque strips along
  the tube UV. This is simpler than a shader solution and produces correct dashed tubes.
- Arrowhead (cone): `ConeGeometry(thickness * 3, thickness * 8, 8)`, rotated to align
  with curve tangent at endpoint, positioned at `controlPoints[last]` minus offset

**Group Rendering — Wireframe Boundaries**

```
DiagramGroupGroup (THREE.Group)
  ├── fillPlane    THREE.Mesh(PlaneGeometry, MeshBasicMaterial)
  ├── borderBox    THREE.LineSegments(EdgesGeometry, LineBasicMaterial)
  └── headerLabel  troika-three-text Text object
```

- Fill plane: Z-offset `depth/2 - 0.5` (behind nodes)
- `MeshBasicMaterial({ color, opacity: fillOpacity, transparent: true, side: THREE.DoubleSide })`
- Border: `EdgesGeometry` of a flat `PlaneGeometry` (just the perimeter)
- Header: top-left corner of bounds, Y above bounds, `fontSize` larger than node labels

**Interaction Registration (Raycasting Seam)**

For each node with `state.clickable === true`:
- Register the full `boxMesh` (the whole `THREE.Mesh`) in a module-level
  `InteractionRegistry` (a `Set<THREE.Mesh>`). There is no separate "front face mesh" —
  `BoxGeometry` creates a single mesh with 6 faces.
- `InteractionRegistry` is exported from `render.ts` for the runtime to consume.
- The runtime's render loop calls `raycaster.intersectObjects([...InteractionRegistry])` on
  pointer events.
- On intersection, **verify it is the front face** before firing the click event:
  ```typescript
  // Convert the hit face's normal to world space
  const worldNormal = intersect.face!.normal.clone()
    .transformDirection(intersect.object.matrixWorld);
  // The front face of a box faces +Z in local space; after world transform,
  // it should roughly face toward the camera. Check it faces the camera:
  const toCamera = camera.position.clone().sub(intersect.point).normalize();
  if (worldNormal.dot(toCamera) > 0.5) {
    // Front-facing hit — fire the click event
  }
  ```
- On confirmed front-face click: emit `DiagramInteractionEvent` to a registered callback.
- v1 callback: calls `scrollEngine.advanceToNextStop()` — triggers scene transition.
- v2 callback: carries full interaction context for free-form exploration.

**Object Lifecycle**

`render.ts` exports a `DiagramRenderer` class (stateful lifecycle required — justifies class):

```typescript
class DiagramRenderer {
  /** Create or update Three.js objects for a DiagramState. */
  update(state: DiagramState, scene: THREE.Scene): void;
  /** Remove all objects associated with a diagram id from scene. */
  dispose(diagramId: string, scene: THREE.Scene): void;
}
```

The `update` method is called each tick by the runtime. It must:
1. Compare incoming state to previous state (by reference — states are immutable records)
2. If state reference unchanged: no-op (return immediately — O(1) identity check)
3. If state changed: diff at the node/edge level and update only changed objects
4. Never dispose and recreate the entire diagram on each tick — that causes frame drops

### 7.2 `src/elements/_shared/` — Shared WebGL Utilities

These two files provide bezel and glow construction used by both `ImagePanelRenderer`
and `ScreenRenderer`. They are in `_shared/` rather than duplicated in each element.
Both files are `render.ts`-tier (Three.js, no React, no compiler).

**`src/elements/_shared/bezelGeometry.ts`**

```typescript
// src/elements/_shared/bezelGeometry.ts
// Shared WebGL utility — Three.js only, no React, no compiler imports.

import * as THREE from 'three';

// Both ImagePanelBezelVariant and ScreenBezelVariant are the same union.
// Define it once here to avoid importing from element type files (which would
// create a cross-tier dependency). The string union is the source of truth.
export type BezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

const BEZEL_DEPTH = 0.25; // world units — gives physical presence without bulk

/**
 * Creates a rectangular bezel frame as a THREE.Group containing four BoxGeometry strips.
 * The frame surrounds a contentWidth × contentHeight opening.
 *
 * @param variant       - Visual style of the bezel frame
 * @param contentWidth  - Inner opening width in world units
 * @param contentHeight - Inner opening height in world units
 * @param thickness     - Border thickness in world units
 * @returns THREE.Group containing top/bottom/left/right strip meshes, or empty group for 'none'
 */
export function createBezel(
  variant: BezelVariant,
  contentWidth: number,
  contentHeight: number,
  thickness: number,
): THREE.Group;
```

- Returns a `THREE.Group` with four `BoxGeometry` strips (top, bottom, left, right)
  arranged as a rectangular frame around the `contentWidth × contentHeight` opening
- `BEZEL_DEPTH` constant: `0.25` world units
- Strip positions:
  - `top`:    `y = contentHeight/2 + thickness/2`,  `BoxGeometry(contentWidth + thickness*2, thickness, BEZEL_DEPTH)`
  - `bottom`: `y = -(contentHeight/2 + thickness/2)`, same geometry
  - `left`:   `x = -(contentWidth/2 + thickness/2)`,  `BoxGeometry(thickness, contentHeight, BEZEL_DEPTH)`
  - `right`:  `x = contentWidth/2 + thickness/2`,     same geometry
- Material per variant:
  - `'dark'`:   `MeshStandardMaterial({ color: '#111111', metalness: 0.8, roughness: 0.3 })`
  - `'light'`:  `MeshStandardMaterial({ color: '#e0e0e0', metalness: 0.4, roughness: 0.4 })`
  - `'chrome'`: `MeshStandardMaterial({ color: '#888888', metalness: 0.95, roughness: 0.05 })`
  - `'thin'`:   Same material as 'dark', effective thickness = `thickness * 0.4`
  - `'none'`:   Returns an empty `THREE.Group` with no children
- All materials: `transparent: true` so the parent Group's opacity can be set uniformly

**`src/elements/_shared/glowSprite.ts`**

```typescript
// src/elements/_shared/glowSprite.ts
// Shared WebGL utility — Three.js only, no React, no compiler imports.

import * as THREE from 'three';

/**
 * Creates a reusable radial gradient canvas texture for glow sprites.
 * Call once and reuse across all glow instances — canvas textures are expensive to create.
 * Returns a 128×128 CanvasTexture: white at center, fully transparent at edges.
 */
export function createGlowTexture(): THREE.CanvasTexture;

/**
 * Creates a glow halo Sprite sized to the given content dimensions.
 *
 * @param color         - CSS hex color string, e.g. '#88ccff'
 * @param contentWidth  - Content plane width in world units
 * @param contentHeight - Content plane height in world units
 * @param scale         - Size multiplier (1.0 = same as content, 1.4 = 40% larger)
 * @param opacity       - Sprite opacity [0–1]
 * @returns THREE.Sprite positioned at z=-0.1 (behind content plane)
 */
export function createGlow(
  color: string,
  contentWidth: number,
  contentHeight: number,
  scale: number,
  opacity: number,
): THREE.Sprite;
```

- `createGlowTexture()`: Creates 128×128 `<canvas>`, draws a radial gradient
  (`createRadialGradient` from center white to edge transparent), wraps as `THREE.CanvasTexture`
- `createGlow()`: Creates `THREE.Sprite` with `SpriteMaterial`:
  - `map: createGlowTexture()` — call once at module level and share (cache the texture)
  - `color: new THREE.Color(color)`
  - `blending: THREE.AdditiveBlending`
  - `transparent: true`
  - `depthWrite: false`
  - `sprite.scale.set(contentWidth * scale, contentHeight * scale, 1)`
  - `sprite.position.z = -0.1` (slightly behind the content plane so it bleeds around edges)

---

### 7.3 `src/elements/image-panel/render.ts` — Approach Description

> **render.ts is specified behaviorally** — implementation uses Three.js r169 APIs.

**ImagePanel Object Hierarchy:**

```
ImagePanelGroup (THREE.Group)
  ├── glowSprite     THREE.Sprite  [if state.glow — from _shared/glowSprite.ts]
  ├── imageMesh      THREE.Mesh(PlaneGeometry, MeshPhysicalMaterial)
  └── bezelGroup     THREE.Group   [from _shared/bezelGeometry.ts]
```

**`imageMesh` material (`THREE.MeshPhysicalMaterial`):**
- `map`: `THREE.TextureLoader` result from `state.src`. Load is async — render a placeholder
  (dark gray plane) until the texture resolves. Replace material.map on load, call
  `material.needsUpdate = true`.
- `clearcoat: state.gloss`
- `clearcoatRoughness: state.glossRoughness`
- `roughness: 0.05`
- `metalness: 0.0`
- `emissive: new THREE.Color(0x111111)`
- `emissiveIntensity: state.selfIllumination`
- `transparent: state.opacity < 1`
- `opacity: state.opacity`
- `side: THREE.FrontSide`

**Height resolution:**
- If `state.height` is defined: `PlaneGeometry(state.width, state.height)`
- If `state.height` is undefined: after texture loads, read `texture.image.width/height`
  to compute aspect ratio, then update geometry: `mesh.geometry = new PlaneGeometry(w, h)`

**`ImagePanelRenderer` class:**

```typescript
class ImagePanelRenderer {
  update(state: ImagePanelState, scene: THREE.Scene): void;
  dispose(panelId: string, scene: THREE.Scene): void;
}
```

Same identity-check optimization as `DiagramRenderer`: if `state` reference is unchanged
from last frame, skip all updates.

---

### 7.4 `src/elements/screen/render.ts` — Approach Description

> **The Screen renderer is a hybrid**: WebGL for bezel/glow, DOM `<iframe>` for content.
> These two layers are independent — no shared Three.js primitives between them.

**Screen WebGL Object Hierarchy:**

```
ScreenGroup (THREE.Group)
  ├── glowSprite     THREE.Sprite  [if state.glow — from _shared/glowSprite.ts]
  └── bezelGroup     THREE.Group   [from _shared/bezelGeometry.ts]
      (NO imageMesh — the bezel inner area is transparent, exposing the iframe beneath)
```

**The iframe overlay:**

The `ScreenRenderer` creates and manages a single `<iframe>` element in the DOM:

```typescript
// Created once on first update()
const iframeDiv = document.createElement('div');
iframeDiv.style.cssText = `
  position: absolute;
  pointer-events: auto;
  overflow: hidden;
  border: none;
`;
const iframe = document.createElement('iframe');
iframe.style.cssText = `
  width: 100%; height: 100%;
  border: none;
  display: block;
`;
iframe.setAttribute('src', state.src);
iframeDiv.appendChild(iframe);
overlayContainer.appendChild(iframeDiv);
```

Where `overlayContainer` is a `<div>` with `position: absolute; inset: 0; pointer-events: none;
z-index: 10` that the engine mounts directly over the WebGL `<canvas>`.

**Per-frame projection (runs every frame in `update()`):**

```typescript
function syncIframeToBezel(
  bezelInnerCornerBL: THREE.Vector3,  // bottom-left of content area in world space
  bezelInnerCornerTR: THREE.Vector3,  // top-right of content area in world space
  camera: THREE.Camera,
  canvasRect: DOMRect,
  iframeDiv: HTMLDivElement,
): void {
  // Clone to avoid mutating cached vectors
  const bl = bezelInnerCornerBL.clone().project(camera);
  const tr = bezelInnerCornerTR.clone().project(camera);

  // NDC [-1,1] → CSS pixels
  const x = (bl.x + 1) / 2 * canvasRect.width;
  const y = (-tr.y + 1) / 2 * canvasRect.height;   // Y-flip: NDC up = CSS up
  const w = (tr.x - bl.x) / 2 * canvasRect.width;
  const h = (bl.y - tr.y) / 2 * canvasRect.height;

  iframeDiv.style.left   = `${canvasRect.left + x}px`;
  iframeDiv.style.top    = `${canvasRect.top  + y}px`;
  iframeDiv.style.width  = `${w}px`;
  iframeDiv.style.height = `${h}px`;
}
```

The two corner vectors are computed from the `ScreenGroup`'s world matrix and the
`state.width`/`state.height` values each frame (after `ScreenGroup.updateWorldMatrix(true, false)`).

**Opacity and visibility sync:**
```typescript
iframeDiv.style.opacity = String(state.opacity);
iframeDiv.style.display = state.enabled ? 'block' : 'none';
// If newly disabled, also set iframe.src = 'about:blank' to stop network activity
```

**`ScreenRenderer` class:**

```typescript
class ScreenRenderer {
  /**
   * @param overlayContainer - The DOM div positioned above the WebGL canvas.
   *   Must be: position:absolute; inset:0; pointer-events:none; z-index:10
   *   The engine is responsible for creating this container and passing it here.
   */
  constructor(overlayContainer: HTMLDivElement);

  /**
   * Update WebGL objects and sync iframe position.
   * @param camera - Current Three.js camera (required for world→screen projection)
   * @param canvasRect - getBoundingClientRect() of the WebGL canvas
   */
  update(
    state: ScreenState,
    scene: THREE.Scene,
    camera: THREE.Camera,
    canvasRect: DOMRect,
  ): void;

  /** Remove WebGL objects and remove iframe from DOM. */
  dispose(screenId: string, scene: THREE.Scene): void;
}
```

> **Engine integration note:** `ScreenRenderer.update()` requires `camera` and `canvasRect`
> as parameters — unlike `DiagramRenderer` which only needs `scene`. The runtime must pass
> these each frame. This is the only screen-specific requirement on the runtime layer.

---

## 8. `src/compiler/handlers.ts` — Registry Integration

This file registers the `diagram`, `image-panel`, and `screen` DSL components with the
`@brewsite/core` compiler registry. It bridges the `@brewsite/diagram` package with
`@brewsite/core`'s compilation pipeline.

```typescript
// src/compiler/handlers.ts
// Registers diagram, image-panel, and screen DSL node handlers with @brewsite/core registry.
// Call registerDiagramHandlers() once at app startup before any scenes compile.
//
// The NodeHandler type (from @brewsite/core sceneDslTypes.ts) is:
//   (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => void
//
// CompileApi.setWidgetState(widgetId, state) is the correct call to store compiled state.
// The widgetId here MUST match the widgetId used in the registered Widget class
// (DiagramWidget, ImagePanelWidget, ScreenWidget).

import type { ReactElement } from 'react';
import { registerNode }    from '@brewsite/core';     // registers a NodeHandler in the compiler registry
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { compileDiagram }    from '../elements/diagram/compile.ts';
import { compileImagePanel } from '../elements/image-panel/compile.ts';
import { compileScreen }     from '../elements/screen/compile.ts';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL }
  from '../elements/diagram/types.ts';
import type { ImagePanelDSL } from '../elements/image-panel/types.ts';
import type { ScreenDSL }     from '../elements/screen/types.ts';
import { Diagram }     from '../elements/diagram/dsl.tsx';
import { ImagePanel }  from '../elements/image-panel/dsl.tsx';
import { Screen }      from '../elements/screen/dsl.tsx';

// ─── DSL Extraction Helpers ───────────────────────────────────────────────────
//
// The `helpers.collectChildren(node)` function from CompileHelpers flattens the
// JSX children tree, expanding React.Fragment, function components, etc.
// Use it to find <DiagramNode>, <DiagramEdge>, <DiagramGroup> children.
//
// Each child is a ReactElement with `child.type` (the component function) and
// `child.props` (the prop object). Compare `child.type === DiagramNode` etc.

/**
 * Extracts a DiagramDSL from a <Diagram> ReactElement.
 * Uses helpers.collectChildren() to traverse the JSX tree.
 *
 * GROUP MEMBERSHIP: <DiagramNode> elements nested inside a <DiagramGroup> children
 * are collected into DiagramGroupDSL.nodeIds. The extraction tracks group context
 * during the recursive walk.
 */
function extractDiagramDSL(node: ReactElement, helpers: CompileHelpers): DiagramDSL {
  const props = node.props as Record<string, unknown>;
  const nodes: DiagramNodeDSL[] = [];
  const edges: DiagramEdgeDSL[] = [];
  const groups: DiagramGroupDSL[] = [];

  const allChildren = helpers.collectChildren(node);

  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    const elProps = el.props as Record<string, unknown>;

    if (el.type === DiagramNode) {
      nodes.push(elProps as DiagramNodeDSL);
    } else if (el.type === DiagramEdge) {
      edges.push(elProps as DiagramEdgeDSL);
    } else if (el.type === DiagramGroup) {
      // Collect nodeIds from direct <DiagramNode> children of this group
      const groupChildren = helpers.collectChildren(el);
      const nodeIds: string[] = [];
      for (const gc of groupChildren) {
        if (gc && typeof gc === 'object' && 'type' in (gc as object)) {
          const gEl = gc as ReactElement;
          if (gEl.type === DiagramNode) {
            nodeIds.push(String((gEl.props as Record<string, unknown>).id));
            // Also add to top-level nodes list with groupId
            nodes.push({ ...(gEl.props as DiagramNodeDSL), groupId: String(elProps.id) });
          }
        }
      }
      groups.push({
        id:            String(elProps.id),
        label:         String(elProps.label ?? ''),
        variant:       elProps.variant as DiagramGroupDSL['variant'],
        orientation:   elProps.orientation as DiagramGroupDSL['orientation'],
        color:         elProps.color as string | undefined,
        borderColor:   elProps.borderColor as string | undefined,
        borderStyle:   elProps.borderStyle as DiagramGroupDSL['borderStyle'],
        fillOpacity:   elProps.fillOpacity as number | undefined,
        borderOpacity: elProps.borderOpacity as number | undefined,
        nodeIds,
      });
    }
  }

  return {
    id:            String(props.id),
    layout:        (props.layout ?? 'grid') as DiagramDSL['layout'],
    layoutSpacing: (props.layoutSpacing ?? [2, 2]) as [number, number],
    nodes,
    edges,
    groups,
  };
}

// ─── Handler Registration ─────────────────────────────────────────────────────
//
// registerNode() (from @brewsite/core) registers a NodeHandler against a DSL component
// function. When the compiler encounters that component in the JSX tree, it calls
// the handler with (node, api, helpers).
//
// api.setWidgetState(widgetId, state) stores compiled state in the SceneFrame.
// The widgetId must match the widgetId of the registered Widget instance.
// For diagram/image-panel/screen, we use the element's `id` prop as the widgetId,
// so each <Diagram id="system-arch"> stores state under widgetId "system-arch".

export function registerDiagramHandlers(): void {
  registerNode(Diagram, (node, api, helpers) => {
    const dsl   = extractDiagramDSL(node, helpers);
    const state = compileDiagram(dsl);
    // widgetId = the diagram's id prop — must match DiagramWidget.widgetId
    api.setWidgetState(String(node.props.id), state);
  });

  registerNode(ImagePanel, (node, api, _helpers) => {
    const dsl   = node.props as ImagePanelDSL;
    const state = compileImagePanel(dsl);
    api.setWidgetState(String(node.props.id), state);
  });

  registerNode(Screen, (node, api, _helpers) => {
    const dsl   = node.props as ScreenDSL;
    const state = compileScreen(dsl);
    api.setWidgetState(String(node.props.id), state);
  });
}
```

> **`registerNode` vs `registerNodeHandler`:** Check `packages/core/src/compiler/registry.ts`
> for the actual export name — it may be `registerNode`, `registerNodeHandler`, or similar.
> Use whatever the registry actually exports. The function takes a component reference
> (the DSL function itself) and a `NodeHandler` callback.
>
> **`DiagramGroupDSL.nodeIds` is populated by the extraction function**, not read from
> the group element's props. The JSX children of `<DiagramGroup>` are walked to build
> this array. Do NOT try to pass `nodeIds` as a prop — it does not appear in `DiagramGroupProps`.
>
> **Widget registration is separate from handler registration.** `registerDiagramHandlers()`
> only tells the COMPILER how to extract DSL state. The Widget classes
> (DiagramWidget, ImagePanelWidget, ScreenWidget) must ALSO be instantiated and registered
> with the `WidgetRegistry` — this is the runtime's responsibility and is done by the
> consuming app when it sets up the engine. See Section 6.4 for Widget class specs.

---

## 9. Package Configuration

### 9.1 `packages/diagram/package.json` (final version)

```json
{
  "name": "@brewsite/diagram",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "public/assets/shapes", "LICENSE", "README.md"],
  "scripts": {
    "build":      "tsc -p tsconfig.build.json",
    "build:lib":  "tsc -p tsconfig.build.json",
    "typecheck":  "tsc --noEmit -p tsconfig.json",
    "test":       "vitest run",
    "test:watch": "vitest",
    "coverage":   "vitest run --coverage"
  },
  "dependencies": {
    "@brewsite/core":    "workspace:*",
    "troika-three-text": "^0.49.1"
  },
  "peerDependencies": {
    "react":     "^19.2.4",
    "react-dom": "^19.2.4",
    "three":     "^0.169.0"
  },
  "devDependencies": {
    "@types/react":         "^19.2.14",
    "@types/react-dom":     "^19.2.3",
    "@types/three":         "^0.169.0",
    "@vitejs/plugin-react": "^4.7.0",
    "@vitest/coverage-v8":  "^2.1.9",
    "typescript":           "^5.9.3",
    "vite":                 "^5.4.21",
    "vitest":               "^2.1.9"
  }
}
```

> **Note on `troika-three-text`:** This is the industry-standard Three.js text rendering
> library. It uses SDF (Signed Distance Field) font rendering for crisp, scalable text
> at any camera distance. It is the only production-quality text solution for Three.js
> that doesn't require pre-baking fonts to geometry. Version ^0.49.x is compatible with
> Three.js r169.

> **Note on published assets:** The `"files"` field includes `public/assets/shapes/` so that
> the icon SVGs are bundled with the published package. Consumers must configure their Vite
> `publicDir` or copy these assets to their own `public/` directory.

### 9.2 `packages/diagram/src/index.ts`

```typescript
// @brewsite/diagram — public package exports

// ─── Diagram element ──────────────────────────────────────────────────────────
export type {
  DiagramState, DiagramNodeState, DiagramEdgeState, DiagramGroupState,
  DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL, DiagramDSL,
  DiagramEdgeStyle, DiagramArrowVariant, DiagramGroupVariant, DiagramOrientation,
  DiagramInteractionEvent,
} from './elements/diagram/types.ts';
export type { DiagramShapeVariant, FlowShape, AwsShape, GcpShape, AzureShape, NetworkShape }
  from './elements/diagram/shapes/shapeVariants.ts';
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup }
  from './elements/diagram/dsl.tsx';
export {
  compileDiagram, compileNode, compileEdge, compileGroup, resolveLayout, routeEdges,
  functionalDiagramTransitionSpec,
} from './elements/diagram/compile.ts';
export { DiagramRenderer }  from './elements/diagram/render.ts';
export { DiagramWidget }    from './elements/diagram/widget.ts';

// ─── ImagePanel element ───────────────────────────────────────────────────────
// Static image displayed on a physical 3D floating plane. Fully WebGL.
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant }
  from './elements/image-panel/types.ts';
export { ImagePanel } from './elements/image-panel/dsl.tsx';
export {
  compileImagePanel,
  functionalImagePanelTransitionSpec,
} from './elements/image-panel/compile.ts';
export { ImagePanelRenderer } from './elements/image-panel/render.ts';
export { ImagePanelWidget }   from './elements/image-panel/widget.ts';

// ─── Screen element ───────────────────────────────────────────────────────────
// Live interactive website in a 3D bezel. WebGL bezel + DOM <iframe> overlay.
export type { ScreenState, ScreenDSL, ScreenBezelVariant }
  from './elements/screen/types.ts';
export { Screen } from './elements/screen/dsl.tsx';
export {
  compileScreen,
  functionalScreenTransitionSpec,
} from './elements/screen/compile.ts';
export { ScreenRenderer } from './elements/screen/render.ts';
export { ScreenWidget }   from './elements/screen/widget.ts';

// ─── Compiler handler registration ────────────────────────────────────────────
// Call registerDiagramHandlers() once at app startup before any scenes compile.
// Also instantiate and register DiagramWidget, ImagePanelWidget, ScreenWidget
// with the WidgetRegistry for runtime rendering.
export { registerDiagramHandlers } from './compiler/handlers.ts';
```

---

## 10. Testing Strategy

### 10.1 Philosophy (per BrewSite conventions)

Tests use **interface-based stateful testing** — real inputs, real outputs, no mocks.
`compile.ts` functions are pure — pass real `DiagramDSL`, assert on `DiagramState`.
No mock infrastructure needed for the compilation layer.

### 10.2 `src/elements/diagram/math/colorUtils.ts` — Specification

```typescript
// src/elements/diagram/math/colorUtils.ts
// Pure hex color manipulation utility. No Three.js. No DOM.

/**
 * Adjusts the lightness of a CSS hex color by a delta amount.
 *
 * @param hex   - CSS hex string: '#rrggbb' (6-digit only, lowercase or uppercase)
 * @param delta - Lightness delta in range [-1, 1].
 *                Positive = lighten (towards white), Negative = darken (towards black).
 *                Applied to the HSL L channel, clamped to [0, 1].
 * @returns     - CSS hex string '#rrggbb' with adjusted lightness
 *
 * Algorithm:
 *   1. Parse hex → RGB (0–255 each)
 *   2. RGB → HSL (H: 0–360, S: 0–1, L: 0–1)
 *   3. L = clamp(L + delta, 0, 1)
 *   4. HSL → RGB → hex string
 *
 * Examples:
 *   deriveColor('#2a2d3e', -0.15) → darker shade (used for sideColor)
 *   deriveColor('#2a2d3e', +0.25) → lighter shade (used for borderColor)
 *   deriveColor('#ffffff', +0.5)  → '#ffffff' (clamped, no change)
 *   deriveColor('#000000', -0.5)  → '#000000' (clamped, no change)
 */
export function deriveColor(hex: string, delta: number): string;
```

### 10.3 Test Files and What They Cover

**`packages/diagram/src/elements/diagram/__tests__/colorUtils.test.ts`**

```typescript
describe('deriveColor', () => {
  it('returns a valid hex string');
  it('darkening returns a darker color (lower L value)');
  it('lightening returns a lighter color (higher L value)');
  it('clamps at black — darken(#000000) returns #000000');
  it('clamps at white — lighten(#ffffff) returns #ffffff');
  it('preserves hue and saturation when adjusting lightness');
  it('handles uppercase hex input');
});
```

**`packages/diagram/src/elements/diagram/__tests__/compile.test.ts`**

```typescript
// Tests for compile.ts pure functions

describe('resolveLayout', () => {
  it('grid: assigns non-overlapping positions to 4 nodes with no explicit positions');
  it('grid: respects explicit positions, only auto-assigns missing ones');
  it('hierarchical: places source nodes above target nodes on Y axis');
  it('manual: throws when a node has no explicit position');
  it('grid: respects layoutSpacing parameter');
});

describe('computeBounds', () => {
  it('computes correct bounding box for a 2x2 grid of nodes');
  it('handles a single node');
  it('handles nodes at negative coordinates');
  it('includes node size in bounds (not just center point)');
});

describe('routeEdges', () => {
  it('produces at least 2 control points per edge');
  it('start point is on the source node face surface (z-offset from face center)');
  it('end point is on the destination node face surface');
  it('handles self-loops gracefully (from === to): returns empty control points array');
  it('handles missing node IDs gracefully: logs warning, returns straight line');
});

describe('compileDiagram', () => {
  it('applies NODE_DEFAULTS to nodes with no explicit values');
  it('resolves iconUrl from iconRegistry for aws:ec2 shape');
  it('does not set iconUrl for flow:rect shape');
  it('compiles a 3-node, 2-edge diagram without throwing');
  it('cameraDistance is positive and greater than diagram width / 2');
  it('groups have computed bounds that contain all member nodes');
  it('edges in compiled output reference valid fromId/toId from nodes list');
  it('auto-generates edge id from from-to when id prop is omitted');
});
```

**`packages/diagram/src/elements/diagram/__tests__/shapeVariants.test.ts`**

```typescript
describe('shapeRequiresIcon', () => {
  it('returns true for aws:ec2');
  it('returns true for gcp:cloud-run');
  it('returns true for azure:app-service');
  it('returns true for flow:cloud');
  it('returns false for flow:rect');
  it('returns false for flow:diamond');
  it('returns false for flow:cylinder');
});
```

**`packages/diagram/src/elements/diagram/__tests__/iconRegistry.test.ts`**

```typescript
describe('resolveIconUrl', () => {
  it('returns correct path for aws:ec2');
  it('returns correct path for flow:cloud');
  it('returns undefined for flow:rect (geometry-only shape)');
  it('returns a path for azure:app-service (open union — dynamic construction)');
  it('returns undefined for custom:my-shape (unknown custom shape)');
});
```

**`packages/diagram/src/elements/image-panel/__tests__/compile.test.ts`**

```typescript
describe('compileImagePanel', () => {
  it('applies default position [0, 0, 0] when not provided');
  it('applies default gloss 0.5 when not provided');
  it('applies default glossRoughness 0.05');
  it('applies default selfIllumination 0.15');
  it('preserves explicit src value');
  it('applies default bezel "dark"');
  it('sets glow: true by default');
  it('height is undefined by default (computed from aspect ratio at render time)');
  it('does not modify explicitly provided height');
  it('does not modify explicitly provided rotation');
});
```

**`packages/diagram/src/elements/screen/__tests__/compile.test.ts`**

```typescript
describe('compileScreen', () => {
  it('applies default position [0, 0, 0] when not provided');
  it('applies default height 7.5 (16:9 at width 12)');
  it('preserves explicit src value');
  it('applies default bezel "dark"');
  it('sets glow: true by default');
  it('does not modify explicitly provided height');
  it('emits console.warn when rotation Y exceeds 0.15 radians');
  it('emits console.warn when rotation X exceeds 0.15 radians');
  it('does NOT warn for rotation values below 0.15 radians');
  it('ScreenState has no gloss field');
  it('ScreenState has no selfIllumination field');
});
```

**`packages/diagram/src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`**

```typescript
// Tests for functionalDiagramTransitionSpec — pure function tests, no mocks.
import { functionalDiagramTransitionSpec } from '../compile.ts';
import type { DiagramState } from '../types.ts';

// Minimal DiagramState factory for tests
const makeState = (nodeZ: number, opacity = 1): DiagramState => ({
  id: 'test',
  layout: 'manual', layoutSpacing: [2, 2],
  nodes: [{ id: 'a', label: 'A', position: [0, 0, nodeZ], opacity, /* ...other required fields */ }],
  edges: [],
  groups: [],
  bounds: { x: 0, y: 0, w: 4, h: 2, minZ: nodeZ, maxZ: nodeZ },
  cameraTarget: [0, 0, 0],
  cameraDistance: 20,
});

describe('functionalDiagramTransitionSpec', () => {
  describe('exitFn', () => {
    it('at t=0 returns fromState opacity unchanged');
    it('at t=1 returns opacity 0 on all nodes');
  });

  describe('enterFn', () => {
    it('at t=0 returns opacity 0 on all nodes');
    it('at t=1 returns toState opacity unchanged');
  });

  describe('interpolateFn', () => {
    it('at t=0 node position matches fromState z=0');
    it('at t=1 node position matches toState z=-50');
    it('at t=0.5 node position is midpoint between from and to');
    it('node absent from fromState fades in (opacity 0 at t=0, full at t=1)');
    it('node absent from toState fades out (full at t=0, opacity 0 at t=1)');
    it('edge control points interpolate at t=0.5');
    it('cameraTarget blends from from.cameraTarget to to.cameraTarget');
    it('cameraDistance blends from from.cameraDistance to to.cameraDistance');
  });
});
```

**`packages/diagram/src/elements/image-panel/__tests__/functionalTransitionSpec.test.ts`**

```typescript
describe('functionalImagePanelTransitionSpec', () => {
  it('exitFn at t=0 returns full opacity');
  it('exitFn at t=1 returns opacity 0');
  it('enterFn at t=0 returns opacity 0');
  it('enterFn at t=1 returns full opacity');
  it('interpolateFn blends position at t=0.5');
  it('interpolateFn blends rotation at t=0.5');
  it('interpolateFn blends opacity at t=0.5');
  it('interpolateFn: src steps at t=0.5 (not blended)');
  it('interpolateFn: bezel steps at t=0.5 (not blended)');
});
```

**`packages/diagram/src/elements/screen/__tests__/functionalTransitionSpec.test.ts`**

```typescript
describe('functionalScreenTransitionSpec', () => {
  it('exitFn at t=1 returns opacity 0 (drives both bezel and iframe CSS)');
  it('enterFn at t=0 returns opacity 0');
  it('interpolateFn blends position at t=0.5');
  it('interpolateFn blends opacity at t=0.5');
  it('interpolateFn: src steps at t=0.5');
  it('interpolateFn: width and height step at t=0.5 (no resize animation)');
});
```

### 10.4 `packages/diagram/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core':    resolve(__dirname, '../../packages/core/src/index.ts'),
      '@brewsite/diagram': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/elements/**/render.ts',    // Three.js — excluded per project convention
        'src/elements/**/_shared/**',   // Three.js shared utilities
        'src/elements/**/widget.ts',    // Widget integration — wires compile+render, integration tested
        'src/**/index.ts',              // barrel files — no logic
        'src/compiler/handlers.ts',     // registration side-effect — integration tested
      ],
    },
  },
});
```

---

## 11. Scene Authoring Examples

### 11.1 Flat Overview Scene (All Nodes at z=0)

```tsx
// apps/examples/architecture/scenes/scene_arch_overview.tsx

import { Scene, Camera } from '@brewsite/core';
import { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from '@brewsite/diagram';

export const sceneArchOverview = {
  id: 'arch-overview',
  index: 0,
  getFrame: () => (
    <Scene id="arch-overview">
      <Camera mode="fixed" position={[0, 0, 30]} target={[0, 0, 0]} />

      <Diagram id="system-arch" layout="manual">

        <DiagramGroup id="frontend" label="Client Tier" variant="swimlane">
          <DiagramNode id="browser"  label="Web Browser"   shape="flow:actor"   position={[-6, 6, 0]} />
          <DiagramNode id="mobile"   label="Mobile App"    shape="net:mobile"   position={[6,  6, 0]} />
        </DiagramGroup>

        <DiagramGroup id="api-tier" label="API Tier" variant="boundary">
          <DiagramNode id="cdn"      label="CloudFront CDN" shape="aws:cloudfront" position={[0, 2, 0]}  clickable={true} />
          <DiagramNode id="alb"      label="Load Balancer"  shape="aws:alb"        position={[0, -1, 0]} clickable={true} />
          <DiagramNode id="api"      label="API Gateway"    shape="aws:api-gateway" position={[0, -4, 0]} clickable={true} />
        </DiagramGroup>

        <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
          <DiagramNode id="ecs"      label="ECS Cluster"   shape="aws:ecs"     position={[-5, -8, 0]} clickable={true} />
          <DiagramNode id="lambda"   label="Lambda"        shape="aws:lambda"  position={[5,  -8, 0]} clickable={true} />
        </DiagramGroup>

        <DiagramGroup id="data" label="Data Tier" variant="swimlane">
          <DiagramNode id="rds"      label="RDS PostgreSQL" shape="aws:rds"      position={[-5, -13, 0]} />
          <DiagramNode id="cache"    label="ElastiCache"    shape="aws:elasticache" position={[0, -13, 0]} />
          <DiagramNode id="s3"       label="S3 Assets"      shape="aws:s3"       position={[5, -13, 0]} />
        </DiagramGroup>

        <DiagramEdge from="browser" to="cdn"    label="HTTPS" />
        <DiagramEdge from="mobile"  to="cdn"    label="HTTPS" />
        <DiagramEdge from="cdn"     to="alb"    />
        <DiagramEdge from="alb"     to="api"    />
        <DiagramEdge from="api"     to="ecs"    label="REST" />
        <DiagramEdge from="api"     to="lambda" label="Events" style="dashed" />
        <DiagramEdge from="ecs"     to="rds"    label="TCP 5432" />
        <DiagramEdge from="ecs"     to="cache"  label="Redis" />
        <DiagramEdge from="ecs"     to="s3"     label="r/w" style="dashed" />
      </Diagram>
    </Scene>
  ),
};
```

### 11.2 Expanded ECS Scene (Node Drills Down in Z + ImagePanel + Screen)

This scene shows both display elements in their natural roles:
- `<ImagePanel>` — a static API documentation screenshot, tilted for perspective
- `<Screen>` — the live API explorer, facing the camera, fully interactive

```tsx
// apps/examples/architecture/scenes/scene_arch_ecs_detail.tsx

import { Scene, Camera } from '@brewsite/core';
import { Diagram, DiagramNode, DiagramEdge, ImagePanel, Screen } from '@brewsite/diagram';

export const sceneArchEcsDetail = {
  id: 'arch-ecs-detail',
  index: 1,
  transitions: [{ start: -20, end: 0, type: 'ease-in-out' }],
  getFrame: () => (
    <Scene id="arch-ecs-detail">
      {/* Camera pushes forward toward ECS node */}
      <Camera mode="fixed" position={[-5, -8, 15]} target={[-5, -8, 0]} />

      {/* Remaining overview nodes recede in Z and shrink */}
      <Diagram id="system-arch">
        <DiagramNode id="cdn"    position={[0,  2,  -25]} opacity={0.3} />
        <DiagramNode id="alb"    position={[0,  -1, -25]} opacity={0.3} />
        <DiagramNode id="api"    position={[0,  -4, -25]} opacity={0.3} />

        {/* ECS node — center stage, pushed slightly back */}
        <DiagramNode id="ecs" label="ECS Cluster" shape="aws:ecs"
          position={[-5, -8, -5]} depth={0.8} color="#1a3d5c" size={[6, 3]} />

        {/* Detail nodes emerge from ECS — positive Z (toward camera) */}
        <DiagramNode id="svc-auth"   label="Auth Service"  shape="flow:rounded"
          position={[-9, -6, 8]} color="#0d3d2b" size={[4, 2]} />
        <DiagramNode id="svc-api"    label="API Service"   shape="flow:rounded"
          position={[-5, -6, 8]} color="#0d3d2b" size={[4, 2]} />
        <DiagramNode id="svc-worker" label="Worker"        shape="flow:rounded"
          position={[-1, -6, 8]} color="#0d3d2b" size={[4, 2]} />

        <DiagramEdge from="ecs"      to="svc-auth"   />
        <DiagramEdge from="ecs"      to="svc-api"    />
        <DiagramEdge from="ecs"      to="svc-worker" />
        <DiagramEdge from="svc-api"  to="rds"        />
        <DiagramEdge from="svc-auth" to="cache"      />
      </Diagram>

      {/*
        ImagePanel: static API docs screenshot, angled slightly.
        Pure WebGL — tilt is fine here. Gloss gives it a screen-like reflection.
      */}
      <ImagePanel
        id="api-docs-screenshot"
        src="/screenshots/api-docs.png"
        position={[5, -4, 12]}
        rotation={[0, -0.2, 0]}
        width={8}
        bezel="dark"
        gloss={0.6}
        selfIllumination={0.2}
        glow={true}
        glowColor="#4488ff"
      />

      {/*
        Screen: live interactive API explorer — faces camera, no tilt.
        The 3D scene plays behind it. Click and interact with the real website.
      */}
      <Screen
        id="api-explorer-live"
        src="https://api.yourproduct.com/docs"
        position={[5, -9, 14]}
        rotation={[0, 0, 0]}
        width={10}
        height={6.25}
        bezel="chrome"
        glow={true}
        glowColor="#6699ff"
        opacity={1}
      />
    </Scene>
  ),
};
```

> **What each element does here:**
> - `ImagePanel` at `rotation={[0, -0.2, 0]}` is angled 11° — looks like a physical
>   framed display. The `gloss` gives a realistic screen reflection under scene lighting.
> - `Screen` at `rotation={[0, 0, 0]}` faces the camera squarely. The live API explorer
>   is fully clickable. The bezel is a WebGL `chrome` frame. The 3D scene continues behind it.
>
> The timeline transition between `arch-overview` and `arch-ecs-detail` drives the Z-depth
> reveal. No new runtime capabilities required — all motion is position/opacity interpolation.

---

## 12. Asset Pipeline — AWS Icon Setup

The official AWS Architecture Icons must be downloaded separately (not bundled in git due
to size). Provide a setup script:

**`packages/diagram/scripts/download-aws-icons.mjs`**

> This script lives at `packages/diagram/scripts/download-aws-icons.mjs`, NOT at the
> repo root `scripts/`. It is specific to the diagram package.

```javascript
// packages/diagram/scripts/download-aws-icons.mjs
// Instructions for setting up AWS Architecture Icons in packages/diagram/public/assets/shapes/aws/
// Run once after cloning: node packages/diagram/scripts/download-aws-icons.mjs

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ICON_DIR = 'packages/diagram/public/assets/shapes/aws';

// AWS icons must be manually downloaded from:
// https://aws.amazon.com/architecture/icons/
// and placed in the directory below with the naming convention:
// ec2.svg, s3.svg, rds.svg, lambda.svg, etc.
//
// The file is a ZIP — extract the SVGs and rename per the iconRegistry.ts map.
// AWS does not provide a direct download URL for automated scripts (CAPTCHA-protected).

console.log(`
AWS Architecture Icons setup required:
1. Download from: https://aws.amazon.com/architecture/icons/
2. Extract the ZIP file
3. Copy relevant SVGs to: ${ICON_DIR}/
4. Rename to match iconRegistry.ts keys (e.g., AmazonEC2.svg → ec2.svg)

See packages/diagram/src/elements/diagram/shapes/iconRegistry.ts for the full mapping.
`);
```

> **Note:** AWS does not provide an automated download URL (the page uses a human-verification
> step). The setup script provides instructions. A future improvement could cache an approved
> icon set in the repo's `.pnpm-store` or a private asset registry.

For `flow:*` shapes that require SVGs (`cloud`, `actor`, `document`, `queue`), these must be
hand-authored or sourced from Apache-licensed icon sets (e.g., Material Icons, Feather Icons).
These ARE safe to commit to git and should be included in the initial implementation.

---

## 13. Lucid Import Script Design

### `scripts/import-lucid.mjs`

**Usage:**
```bash
node scripts/import-lucid.mjs path/to/diagram.lucid --page 0 --out src/scenes/myDiagram.tsx
```

**Input:** `.lucid` file (ZIP archive containing `document.json` in HJSON)

**Output:** A BrewSite DSL `.tsx` file containing `<Diagram>` JSX

**Dependencies:** `adm-zip` (ZIP extraction), `hjson` (HJSON parsing) — both added to root
devDependencies.

**Algorithm:**

```javascript
// 1. Unzip the .lucid file
// 2. Parse document.json from HJSON → plain JSON object
// 3. Select the specified page (default: page 0)
// 4. For each shape on the page:
//    a. Look up shape.type in LUCID_SHAPE_MAP → DiagramShapeVariant
//    b. Convert boundingBox {x, y, w, h} from Lucid pixel coords to diagram units
//       (divide by PIXEL_TO_UNIT = 100)
//    c. Extract text as label (first text value), style.fill as color
//    d. Collect group membership from shape.parentId
// 5. For each line on the page:
//    a. Extract endpoint1.shapeId → from, endpoint2.shapeId → to
//    b. Map line style to DiagramEdgeStyle
// 6. For each group:
//    a. Extract group.text as group label
//    b. Collect member shapes by parentId matching
// 7. Emit DSL file

const LUCID_SHAPE_MAP = {
  // Lucid type → DiagramShapeVariant
  'rectangleShape':    'flow:rect',
  'roundedRectangleShape': 'flow:rounded',
  'processShape':      'flow:rounded',
  'decisionShape':     'flow:diamond',
  'databaseShape':     'flow:cylinder',
  'ovalShape':         'flow:oval',
  'cloudShape':        'flow:cloud',
  'actorShape':        'flow:actor',
  'documentShape':     'flow:document',
  'parallelogramShape': 'flow:parallelogram',
  // AWS — Lucid uses "aws3.ServiceName" pattern
  'aws3.EC2':          'aws:ec2',
  'aws3.S3':           'aws:s3',
  'aws3.RDSInstance':  'aws:rds',
  'aws3.Lambda':       'aws:lambda',
  'aws3.ApplicationLoadBalancing': 'aws:alb',
  'aws3.CloudFront':   'aws:cloudfront',
  'aws3.VPC':          'aws:vpc',
  'aws3.ECSContainer': 'aws:ecs',
  'aws3.SQSQueue':     'aws:sqs',
  'aws3.SNSTopic':     'aws:sns',
  // Unknown shapes fall back to 'flow:rect' with a console.warn
};

// Position normalization: Lucid coordinates are in pixels (Y-down).
// BrewSite uses diagram units (Y-up). Convert:
// brewsiteX = lucidX / PIXEL_TO_UNIT
// brewsiteY = -lucidY / PIXEL_TO_UNIT  (flip Y axis)
const PIXEL_TO_UNIT = 100;
```

**Output format example:**
```tsx
// Auto-generated by import-lucid.mjs from: system-architecture.lucid
// Page: 0 — "Architecture Overview"
// Imported: 2026-02-25

import { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from '@brewsite/diagram';

export const importedDiagram = (
  <Diagram id="system-architecture" layout="manual">

    <DiagramGroup id="group-1" label="Frontend">
      <DiagramNode id="node-abc123" label="Web App" shape="flow:rect"
        position={[0, 2, 0]} size={[4, 2]} color="#dae8fc" />
    </DiagramGroup>

    <DiagramNode id="node-def456" label="API Gateway" shape="aws:api-gateway"
      position={[0, 0, 0]} size={[4, 2]} color="#ffe6cc" />

    <DiagramEdge from="node-abc123" to="node-def456" />

  </Diagram>
);
```

---

## 14. Implementation Build Sequence

Implement in this order. Each step is independently testable before proceeding.

### Phase 1 — Type Contracts (no tests yet, just types)
1. `src/elements/diagram/shapes/shapeVariants.ts`
2. `src/elements/diagram/types.ts`
3. `src/elements/image-panel/types.ts`
4. `src/elements/screen/types.ts`
5. Run `pnpm typecheck` — must pass with zero errors

### Phase 2 — DSL Components
6. `src/elements/diagram/dsl.tsx`
7. `src/elements/image-panel/dsl.tsx`
8. `src/elements/screen/dsl.tsx`
9. `src/index.ts` (initial exports — all three elements)
10. Run `pnpm typecheck` — must pass

### Phase 3 — Compile Layer + Tests
11. `src/elements/diagram/math/colorUtils.ts` — implement `deriveColor(hex, delta)` first since compile.ts depends on it
12. `src/elements/diagram/shapes/iconRegistry.ts`
13. `src/elements/diagram/compile.ts` — implement all functions + `functionalDiagramTransitionSpec`
14. `src/elements/image-panel/compile.ts` — `compileImagePanel()` + `functionalImagePanelTransitionSpec`
15. `src/elements/screen/compile.ts` — `compileScreen()` + `functionalScreenTransitionSpec`
16. `src/elements/diagram/__tests__/colorUtils.test.ts`
17. `src/elements/diagram/__tests__/iconRegistry.test.ts`
18. `src/elements/diagram/__tests__/shapeVariants.test.ts`
19. `src/elements/diagram/__tests__/compile.test.ts`
20. `src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`
21. `src/elements/image-panel/__tests__/compile.test.ts`
22. `src/elements/image-panel/__tests__/functionalTransitionSpec.test.ts`
23. `src/elements/screen/__tests__/compile.test.ts`
24. `src/elements/screen/__tests__/functionalTransitionSpec.test.ts`
25. Run `pnpm test` — all tests must pass

### Phase 4 — Shared WebGL Utilities
26. `src/elements/_shared/bezelGeometry.ts`
27. `src/elements/_shared/glowSprite.ts`
28. Visual smoke test: call `createBezel('dark', 10, 6, 0.3)`, inspect result in dev console

### Phase 5 — Render Layer + Widget Classes
29. `src/elements/diagram/shapes/geometryFactory.ts`
30. `src/elements/diagram/render.ts`
31. `src/elements/image-panel/render.ts` — uses `_shared/bezelGeometry` + `_shared/glowSprite`
32. `src/elements/screen/render.ts` — uses `_shared/bezelGeometry` + `_shared/glowSprite` + DOM iframe
33. `src/elements/diagram/widget.ts` — `DiagramWidget` implements `ISceneElement<DiagramState>`
34. `src/elements/image-panel/widget.ts` — `ImagePanelWidget`
35. `src/elements/screen/widget.ts` — `ScreenWidget`

### Phase 6 — Compiler Handler Registration + Widget Wiring
36. `src/compiler/handlers.ts`
37. Update `src/index.ts` to export all functional specs, widget classes, `registerDiagramHandlers`
38. Wire up in `apps/examples` entry point:
    - Call `registerDiagramHandlers()` (compiler side)
    - Instantiate and register widget instances with `WidgetRegistry` (runtime side)
39. Integrate into `apps/examples` — simple 3-node diagram scene + one `<ImagePanel>` + one `<Screen>`
40. Visual verification: nodes are physical boxes, edges are tubes, ImagePanel has bezel + gloss
41. Visual verification: `<Screen>` iframe tracks bezel position on camera move

### Phase 7 — Shape Assets
34. Download AWS Architecture Icons, rename per `iconRegistry.ts` map, place in `public/assets/shapes/aws/`
35. Add `flow:*` SVG files (cloud, actor, document, queue) — hand-authored or Apache-licensed set
36. Verify icon rendering in dev server for `aws:ec2`, `aws:lambda`, `flow:cloud`

### Phase 8 — Lucid Import Script
37. Add `adm-zip` and `hjson` to root devDependencies
38. Implement `scripts/import-lucid.mjs`
39. Test with a real `.lucid` export from Lucidchart

### Phase 9 — Example Scenes
40. Author the full `arch-overview` and `arch-ecs-detail` scenes (Section 11)
41. Add `<ImagePanel>` with a tilted screenshot and `<Screen>` with a localhost URL
42. Verify the Z-depth transition plays correctly across scene stops

---

## 15. Dependencies Summary

| Package | Version | Type | Justification |
|---|---|---|---|
| `@brewsite/core` | `workspace:*` | dependency | compiler registry, scene types, runtime, `FunctionalTransitionSpec`, blend helpers |
| `troika-three-text` | `^0.49.1` | dependency | SDF text rendering for node labels |
| `three` | `^0.169.0` | peerDependency | must match host app's Three.js instance |
| `react` | `^19.2.4` | peerDependency | DSL components are React |
| `adm-zip` | `^0.5.x` | devDependency (root) | Lucid import script — ZIP extraction |
| `hjson` | `^3.x` | devDependency (root) | Lucid import script — HJSON parsing |

No new `peerDependencies` beyond Three.js and React. The `troika-three-text` dependency is
a direct dependency (not peer) because it is an implementation detail of `render.ts` —
consumers do not need to install it separately.

**Imports from `@brewsite/core` used by `compile.ts` files:**

```typescript
// In each element's compile.ts:
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendVec3, blendOpacity, blendColor } from '@brewsite/core';
```

`FunctionalTransitionSpec`, `blendNumber`, `blendVec3`, `blendOpacity`, and `blendColor`
are all exported from `packages/core/src/compiler/transitions/transitionTypes.ts` and
must be available via the top-level `@brewsite/core` barrel. If they are not yet in the
barrel export, add them to `packages/core/src/index.ts` before implementing the diagram
package.

**Imports from `@brewsite/core` used by `widget.ts` files:**

```typescript
// In each element's widget.ts:
import type { ISceneElement } from '@brewsite/core';
```

`ISceneElement<T>` is in `packages/core/src/widget/types.ts`. Verify it is exported
from the core barrel and that its `apply()` method signature matches what is documented
in Section 6.4 before implementing the Widget classes.
