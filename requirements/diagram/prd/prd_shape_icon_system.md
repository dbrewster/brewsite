---
title: "BrewSite Diagram — Shape and Icon System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-02
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram shape and icon system as implemented."
---

## Overview

The shape and icon system in `@brewsite/diagram` controls the visual identity of diagram nodes. A node's appearance is determined by two independent axes: its **geometry shape** (the 3D prism form rendered as a `THREE.BufferGeometry`) and its **icon overlay** (an SVG or raster image rendered on the front face). These are configured by the `shape` and `icon` props on `DiagramNode` in the DSL. The shape type is defined in `shapes/shapeVariants.ts`, geometry construction in `shapes/geometryFactory.ts`, icon URL resolution in `shapes/iconRegistry.ts`, async loading in `rendering/IconLoader.ts`, and 3D SVG rendering in `shapes/svgIcon3D.ts`. The system affects `@brewsite/diagram` exclusively.

## Problem Statement

Diagram nodes in a 3D scene need to communicate semantics visually beyond color alone. Architecture diagrams use cloud provider service icons; network diagrams use router/firewall symbols; flow diagrams use cylinder and diamond shapes. Without a built-in catalog of both geometry shapes and icon namespaces, every consumer must author their own SVG loading pipeline, manage async load state, and handle Three.js geometry construction — a high-friction integration requirement that blocks adoption for the most common diagram use cases.

## Goals and Success Metrics

**Primary goals:**
- A consumer can place an AWS Lambda node with a single DSL prop (`icon="aws:lambda"`) and receive correct geometry with the official service icon rendered on the front face
- All built-in icon namespaces resolve synchronously to URLs at compile time; only the Three.js SVG load is async
- The icon loader cache ensures no URL is fetched or parsed more than once per session
- Geometry construction is pure Three.js code isolated in `render.ts`-layer files; no geometry creation occurs in the compiler

**Success metrics:**
- All `aws:`, `gcp:`, `azure:`, `ui:`, `tech:`, `security:`, `data:`, and `net:` namespaces have fully populated URL maps in `iconRegistry.ts`
- `resolveIconUrl` unit tested for one sample from each namespace
- `createShapeGeometry` unit tested for all 15 `DiagramNodeShape` values
- Icon load time for a 20-node diagram (all different icons) is below 2 seconds on a local dev server

**Guardrail metrics:**
- Adding a new icon name to an existing namespace is a minor version bump with no breaking change
- Removing an icon name is a major version bump
- The `custom:` namespace never resolves to a URL by default — this behavior must not change without a major bump

## Non-Goals

- Raster PNG/JPG icon support at the DSL level (raster icons are only supported via `IconLoader`'s `TextureLoader` path when a URL ends in a non-`.svg` extension, but this is not an authored concept in the DSL)
- Interactive icon palette UI or icon browser for consumers
- Runtime icon injection (no dynamic namespace registration at playback time)
- Per-node custom geometry via consumer-provided `BufferGeometry` instances — shape is always resolved from the built-in `DiagramNodeShape` union
- Icon animation (no frame-based icon updates; icons are static geometry placed on node mount)

## Consumer Stories

- As a toolkit consumer, I want to specify `icon="aws:lambda"` on a node so that the official AWS Lambda icon renders on the node face without any additional asset configuration.
- As a toolkit consumer, I want to specify `shape="hexagon"` so that service nodes in my cluster diagram use a distinctive hexagonal prism instead of the default rectangle.
- As a toolkit consumer, I want to set `iconStyle="extruded"` on a node so that the icon has physical 3D depth rather than being a flat 2D overlay.
- As a toolkit consumer, I want `custom:my-icon` to produce an invisible (no icon) node by default, so that I can introduce custom icons incrementally without breaking existing scenes.

## Functional Requirements

1. `DiagramNodeShape` shall be a closed TypeScript union exported from `shapes/shapeVariants.ts`.
2. `DiagramIconVariant` shall be a discriminated string union over all namespaced icon values, exported from `shapes/shapeVariants.ts`.
3. `resolveIconUrl(icon)` shall return a `string` URL for all built-in namespaces and `undefined` for `custom:*` and unrecognized values.
4. `resolveIconUrl` shall run at compile time (pure function, no async, no Three.js).
5. `createShapeGeometry(shape, size, depth, cornerRadius)` shall return a `ShapeGeometrySpec` containing a `THREE.BufferGeometry` and a `materialCount` discriminant (2 or 6).
6. `createShapeGeometry` shall handle all 15 `DiagramNodeShape` values and shall log a warning and fall back to `BoxGeometry` for any unrecognized value at runtime (exhaustive switch with `never` guard).
7. The `IconLoader` (`sharedIconLoader`) shall cache resolved `THREE.Object3D` templates by a composite key of `url + width + height + style + maxDepth`. Subsequent requests for the same key shall resolve from cache without a network request.
8. Each node receiving an icon from the cache shall receive a deep clone with independent material instances, so that per-node color tinting and opacity do not bleed between nodes.
9. `sharedIconLoader.disposeAll()` shall clear the cache and allow garbage collection of all cached geometries and textures.
10. `custom:*` icon variants shall not throw — `resolveIconUrl` returns `undefined` and `NodeRenderer` skips icon creation.
11. Icon geometry shall be centered on the node's front face. When both `label` and `icon` are present, the icon occupies the upper portion of the safe content rect and the label renders below it.
12. Corner radius shall apply only to `rectangle` and `square` shapes. All other shapes shall ignore the `cornerRadius` field.

## API Design

### DiagramNodeShape

```typescript
// packages/diagram/src/elements/diagram/shapes/shapeVariants.ts

export type DiagramNodeShape =
  // Regular polygon prisms (ExtrudeGeometry of N-sided shape)
  | 'circle'        // 64-sided smooth approximation
  | 'triangle'      // 3-sided
  | 'square'        // 4-sided, equal-axis
  | 'rectangle'     // 4-sided free-aspect — DEFAULT
  | 'pentagon'      // 5-sided
  | 'hexagon'       // 6-sided
  | 'heptagon'      // 7-sided
  | 'octagon'       // 8-sided
  | 'nonagon'       // 9-sided
  | 'decagon'       // 10-sided
  // Special 2D shapes (ExtrudeGeometry or BoxGeometry)
  | 'diamond'       // rotated BoxGeometry (45°)
  | 'oval'          // scaled SphereGeometry (ellipsoid)
  | 'cloud'         // cloud silhouette (ExtrudeGeometry)
  | 'document'      // rectangle with folded top-right corner (ExtrudeGeometry)
  | 'parallelogram'; // sheared rectangle (ExtrudeGeometry)

export const DEFAULT_NODE_SHAPE: DiagramNodeShape = 'rectangle';
```

### DiagramIconVariant

```typescript
export type DiagramIconVariant =
  | FlowIconShape      // flow:actor, flow:cylinder, flow:cylinder-stack, flow:queue
  | UiShape            // ui:server, ui:cloud, ui:user, ... (Heroicons 24/outline)
  | TechShape          // tech:docker, tech:kubernetes, tech:react, ... (Simple Icons)
  | SecurityShape      // security:shield, security:lock, security:mfa, ...
  | DataShape          // data:pipeline, data:stream, data:warehouse, ...
  | AwsShape           // aws:lambda, aws:s3, aws:rds, ... (AWS Architecture Icons)
  | GcpShape           // gcp:compute-engine, gcp:bigquery, gcp:cloud-run, ...
  | AzureShape         // azure:virtual-machine, azure:functions, azure:aks, ...
  | NetworkShape       // net:router, net:firewall, net:load-balancer, ...
  | `custom:${string}`; // escape hatch; resolves to undefined by default
```

### Icon URL resolution

```typescript
// packages/diagram/src/elements/diagram/shapes/iconRegistry.ts

export function resolveIconUrl(icon: DiagramIconVariant | undefined): string | undefined;
```

Resolution strategy by namespace:
- `ui:*` — `namespaceUrl('ui', iconName(icon))` → `/assets/shapes/ui/{name}.svg`
- `tech:*` — `namespaceUrl('tech', iconName(icon))` → `/assets/shapes/tech/{name}.svg`
- `security:*` — `namespaceUrl('security', iconName(icon))` → `/assets/shapes/security/{name}.svg`
- `data:*` — `namespaceUrl('data', iconName(icon))` → `/assets/shapes/data/{name}.svg`
- `net:*` — `NET_ICON_MAP[icon]` → `/assets/shapes/net/{name}.svg`
- `aws:*` — `AWS_ICON_MAP[icon]` → `/assets/shapes/aws/{name}.svg`
- `gcp:*` — `GCP_ICON_MAP[icon]` → `/assets/shapes/gcp/{name}.svg`
- `azure:*` — `AZURE_ICON_MAP[icon]` → `/assets/shapes/azure/{name}.svg`
- `flow:actor`, `flow:queue` — `FLOW_ICON_MAP[icon]` → `/assets/shapes/flow/{name}.svg`
- `custom:*` — returns `undefined`

`net:`, `aws:`, `gcp:`, and `azure:` use explicit maps typed against their respective shape unions. `ui:`, `tech:`, `security:`, and `data:` use a convention-based path derivation (name IS the filename stem), populated by `scripts/sync-icons.mjs`.

### Geometry factory

```typescript
// packages/diagram/src/elements/diagram/shapes/geometryFactory.ts

export type ShapeGeometrySpec = {
  geometry: THREE.BufferGeometry;
  rotation?: THREE.Euler;
  materialCount: 2 | 6;
  // materialCount: 2 → group 0 = caps (face color), group 1 = walls (side color)
  //                 6 → BoxGeometry or SphereGeometry (single surface)
};

export function createShapeGeometry(
  shape: DiagramNodeShape,
  size: readonly [number, number],
  depth: number,
  cornerRadius?: number,
): ShapeGeometrySpec;

export function createShapeOutlineGeometry(
  shape: DiagramNodeShape,
  w: number,
  h: number,
  depth: number,
  cornerRadius: number,
): THREE.BufferGeometry;

export function createRoundedRectShape(
  w: number,
  h: number,
  cornerRadius: number,
): THREE.Shape;

export function getContentRect(
  shape: DiagramNodeShape,
  size: readonly [number, number],
): readonly [number, number];

export function isRectangularShape(shape: DiagramNodeShape): boolean;
```

`getContentRect` returns the largest safe axis-aligned content area inside the shape for icon and label placement. For `rectangle`/`square` this is the full bounding box. For polygon shapes it uses `2 * apothem * 0.85` as the inscribed-circle estimate. For `cloud` and `document` it uses empirical fractions of the bounding box.

### Icon loader

```typescript
// packages/diagram/src/elements/diagram/rendering/IconLoader.ts

export interface IIconLoader {
  load(
    url: string,
    width: number,
    height: number,
    style: SvgIcon3DStyle,
    maxDepth: number,
    metalness: number,
    roughness: number,
  ): Promise<THREE.Object3D>;
  disposeAll(): void;
}

export const sharedIconLoader: IIconLoader;
```

`sharedIconLoader` is a module-level singleton. The cache key is `"${url}|${width}|${height}|${style}|${maxDepth}"`. For SVG icons with `style === 'flat'`, `THREE.SVGLoader` parses SVG paths into `ShapeGeometry` meshes with `MeshBasicMaterial`. For `style !== 'flat'`, `buildSvgIcon3D` from `shapes/svgIcon3D.ts` constructs `ExtrudeGeometry` layers with `MeshStandardMaterial`. For non-SVG URLs, `THREE.TextureLoader` produces a `PlaneGeometry` with `MeshBasicMaterial`.

Each `load()` call returns a fresh deep clone of the cached template with independently cloned material instances.

### SvgIcon3DStyle

```typescript
// packages/diagram/src/elements/diagram/types.ts

export type SvgIcon3DStyle = 'flat' | 'extruded' | 'layered' | 'embossed';
```

- **`flat`** — `ShapeGeometry` + `MeshBasicMaterial`. Unlit, always visible, zero depth. Fastest render path.
- **`extruded`** — `ExtrudeGeometry` with uniform depth from `iconDepth`. `MeshStandardMaterial`, PBR-lit. Best for monochrome icons.
- **`layered`** — Multi-layer extrusion; each SVG path group extruded at a different Z offset for depth separation. Best for multi-color cloud provider icons.
- **`embossed`** — Icon raised from the node face surface; depth controlled by `iconDepth`. Icon merges visually with the node geometry rather than floating above it.

Theme default: `darkGlassTheme.node.defaultIconStyle = 'extruded'`; `enterpriseTheme` and `lightMinimalTheme` default to `'flat'`.

### Full namespace membership

**`flow:` (FlowIconShape):** `flow:actor`, `flow:cylinder`, `flow:cylinder-stack`, `flow:queue`. Note: `flow:cylinder` and `flow:cylinder-stack` have no built-in asset and resolve to `undefined`; they are retained for compatibility.

**`ui:` (UiShape) — Heroicons 24/outline, MIT license.** Representative members: `ui:server`, `ui:server-stack`, `ui:cpu-chip`, `ui:circle-stack`, `ui:cloud`, `ui:cloud-arrow-up`, `ui:cloud-arrow-down`, `ui:signal`, `ui:globe-alt`, `ui:user`, `ui:users`, `ui:user-group`, `ui:shield-check`, `ui:lock-closed`, `ui:key`, `ui:finger-print`, `ui:eye`, `ui:document-text`, `ui:chart-bar`, `ui:code-bracket`, `ui:cog-6-tooth`, `ui:arrow-path`, `ui:bell`, `ui:magnifying-glass`, `ui:wrench-screwdriver`, `ui:computer-desktop`, `ui:device-phone-mobile`, `ui:credit-card`, `ui:bolt`, `ui:sparkles`. Full list defined in `UiShape`.

**`tech:` (TechShape) — Simple Icons, MIT license.** Representative members: `tech:docker`, `tech:kubernetes`, `tech:helm`, `tech:terraform`, `tech:react`, `tech:nextjs`, `tech:typescript`, `tech:python`, `tech:go`, `tech:rust`, `tech:postgresql`, `tech:redis`, `tech:mongodb`, `tech:kafka`, `tech:prometheus`, `tech:grafana`, `tech:github`, `tech:gitlab`, `tech:nginx`, `tech:istio`, `tech:huggingface`, `tech:opentelemetry`. Full list defined in `TechShape`.

**`security:` (SecurityShape):** `security:shield`, `security:shield-alert`, `security:lock`, `security:unlock`, `security:key`, `security:fingerprint`, `security:eye`, `security:eye-hidden`, `security:certificate`, `security:audit`, `security:alert`, `security:mfa`, `security:vpn`, `security:waf`, `security:ddos`, `security:threat`, `security:incident`, `security:scan`, `security:token`, `security:policy`, `security:compliance`, `security:rbac`, `security:sso`, `security:sandbox`, `security:encryption`.

**`data:` (DataShape):** `data:pipeline`, `data:stream`, `data:batch`, `data:warehouse`, `data:lake`, `data:etl`, `data:transform`, `data:aggregate`, `data:schema`, `data:partition`, `data:query`, `data:report`, `data:dashboard`, `data:event`, `data:webhook`, `data:api`, `data:cdc`, `data:lineage`, `data:catalog`, `data:mart`.

**`net:` (NetworkShape):** `net:router`, `net:switch`, `net:firewall`, `net:load-balancer`, `net:server`, `net:desktop`, `net:mobile`, `net:dns`, `net:vpn`, `net:proxy`, `net:nat`, `net:rack`, `net:datacenter`, `net:cluster`, `net:cdn-pop`, `net:wifi-ap`, `net:segment`, `net:packet`, `net:wan`, `net:vlan`, `net:peering`, `net:bgp`, `net:private-link`, `net:internet`, `net:tablet`.

**`aws:` (AwsShape) — AWS Architecture Icons, CC-BY-ND 2.0.** Full list defined in `AwsShape` across compute, storage, database, networking, integration, security, developer tools, analytics, and AI/ML service categories.

**`gcp:` (GcpShape) — Google Cloud Icons, Apache 2.0.** Full list defined in `GcpShape` across compute, storage, database, networking, AI/ML, management, and analytics categories.

**`azure:` (AzureShape) — Azure Architecture Icons.** Full list defined in `AzureShape` across compute, storage, database, networking, integration, security, DevOps, AI/ML, management, and analytics categories.

## Technical Considerations

### Compile-time vs. render-time boundary

`resolveIconUrl` runs at compile time (inside `compile.ts`) and its result is stored on `DiagramNodeState.iconUrl`. `render.ts` reads only `iconUrl` (a plain string or `undefined`) — it never imports from `iconRegistry.ts`. This preserves the hard compile/render separation: the compiler has no Three.js; the renderer has no compiler imports.

### Geometry caching

`geometryFactory.ts` does not maintain an internal cache. `NodeRenderer` is responsible for caching `BufferGeometry` instances by node ID and only calling `createShapeGeometry` when the shape or dimensions change. The geometry factory itself is a pure factory function with no side effects.

### materialCount discriminant

The `ShapeGeometrySpec.materialCount` field (2 or 6) tells `NodeRenderer` how many material slots to create:
- `2` — `ExtrudeGeometry`-based shapes: index 0 = front + back caps (face color and emissive), index 1 = walls (side color)
- `6` — `BoxGeometry` and `SphereGeometry`: all groups share a single surface; `NodeRenderer` applies material[0] to all groups

`materialCount` eliminates an O(N) shape dispatch in `NodeRenderer` at render time.

### SVG icon scaling and centering

`IconLoaderImpl` scales flat SVG icons to fit within `[width, height]` by computing a uniform scale factor from the SVG's bounding box. The icon group is translated so its center aligns with the node face origin. For 3D icon styles, `buildSvgIcon3D` handles its own internal fit-to-bounds logic.

### Icon layout with label

`NodeRenderer` uses `getContentRect(shape, size)` to determine the available content area. When `icon` is present and `label` is non-empty:
- Icon is centered in the upper ~55% of the content rect height
- Label is placed in the lower ~35% (sublabel below label if present)

When only icon is present (no label), the icon is centered in the full content rect.

### Icon sync pipeline

SVG assets for `ui:`, `tech:`, `security:`, `data:`, and `net:` namespaces are managed by `scripts/sync-icons.mjs`. Running `pnpm sync:icons` from the repo root fetches Heroicons and Simple Icons from their npm packages and copies the required SVGs into `packages/diagram/public/assets/shapes/`. Cloud provider icon sets (`aws:`, `gcp:`, `azure:`) have placeholder SVGs populated from Heroicons until official icons are downloaded via `scripts/download-cloud-icons.mjs`.

### Tree-shaking

`DiagramIconVariant` is a union of string literal types — no runtime object. `resolveIconUrl` uses string prefix checks (`icon.startsWith('aws:')`) rather than a single flat map over all variants, which allows bundlers to tree-shake unused namespace maps (e.g., an app that uses only `ui:` and `tech:` icons will not include `AWS_ICON_MAP` in its bundle if the code path for `aws:` is unreachable).

## Breaking Change Assessment

**Semver impact: none (initial documentation of stable API).**

- Adding a new value to any `*Shape` union: **minor** bump
- Removing a value from any `*Shape` union: **major** bump (breaks scenes using that icon value)
- Adding a new `SvgIcon3DStyle` value: **minor** bump
- Changing `resolveIconUrl` to return a non-`undefined` for `custom:*` by default: **major** bump (changes observable behavior)
- Adding a new `DiagramNodeShape` value: **minor** bump
- Removing a `DiagramNodeShape` value: **major** bump

The `flow:cylinder` and `flow:cylinder-stack` values currently exist in `FlowIconShape` but have no asset (resolve to `undefined`). Removing them from the union would be a breaking change and requires a major version bump even though they currently produce no visible geometry.

## Dependencies

- `THREE.ExtrudeGeometry`, `THREE.BoxGeometry`, `THREE.SphereGeometry` — geometry construction (render layer only)
- `THREE.SVGLoader` (`three/examples/jsm/loaders/SVGLoader.js`) — SVG path parsing
- `THREE.TextureLoader` — raster icon fallback
- `scripts/sync-icons.mjs` — asset sync pipeline (dev tooling, not a runtime dependency)
- No new external npm packages

## Risks and Mitigations

**API regret — `custom:` namespace:** The `custom:` namespace is explicitly reserved but has no registration mechanism in the current API. Consumers who need custom icons today must fork or extend `iconRegistry.ts`. A future `registerIconResolver` API would need to be careful not to break tree-shaking. For now the escape hatch is deliberate and documented.

**Cloud icon licensing compliance:** AWS Architecture Icons carry CC-BY-ND 2.0, which requires attribution and prohibits derivative works. GCP and Azure icons have their own terms. All cloud icon sets use placeholder SVGs from Heroicons in the default package distribution; consumers must run `download-cloud-icons.mjs` and agree to the respective terms to use official icons. This is a legal risk, not a technical one.

**SVG complexity and load time:** Simple Icons for `tech:` namespace includes brand logos with varying SVG complexity. High-path-count logos can produce large `ExtrudeGeometry` meshes for non-flat icon styles. Mitigation: default icon style is `'extruded'` for dark themes but `'flat'` for `lightMinimalTheme` and `enterpriseTheme`. The `sharedIconLoader` cache ensures each icon is parsed only once per session.

**`custom:*` open template literal in TypeScript:** The `custom:${string}` type is a template literal type. It cannot be enumerated in a `Record<>` key. `iconRegistry.ts` uses explicit `icon.startsWith()` dispatch rather than a record lookup specifically to avoid this TypeScript constraint.

## Open Questions

- Should `IconLoader.load()` accept an optional `color: string` parameter to tint the icon material at load time, avoiding the need for a post-load traversal when per-node icon colors differ from the SVG fill colors? This would complicate the cache key but enable more flexible icon theming.
- Should `getContentRect` be used by the compiler to store the computed content rect on `DiagramNodeState`, or should it remain a render-time utility? Moving it to compiled state would allow external tools to know the safe content area without running Three.js.
- Should `flow:cylinder` and `flow:cylinder-stack` be deprecated in favor of a future 3D cylinder geometry shape? These values are currently dead weight in the type union.

## Launch Criteria

- `resolveIconUrl` unit tested for one sample from each of the 9 namespaces, plus `undefined` for `custom:*` and `undefined` input
- `createShapeGeometry` unit tested for all 15 `DiagramNodeShape` values (returns a `BufferGeometry` without throwing)
- `getContentRect` unit tested for `rectangle`, `circle`, `hexagon`, `diamond`, and `cloud`
- `sharedIconLoader.load()` integration tested with a real SVG file for `flat` and `extruded` styles
- `sharedIconLoader.disposeAll()` tested to produce an empty cache after a load
- `DiagramIconVariant`, `DiagramNodeShape`, `SvgIcon3DStyle` all exported from `@brewsite/diagram`
- `scripts/sync-icons.mjs` documented in the monorepo CLAUDE.md under asset pipeline
- Example scene in `apps/examples/diagram/` uses at least 3 different icon namespaces to demonstrate coverage
