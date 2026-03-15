---
title: "@brewsite/diagram — Interactive Canvas"
doc_type: note
owner: claude-author
status: active
updated: 2026-03-15
---

## DiagramCanvas Overview

In BrewSite, "DiagramCanvas" is the name for the interactive orthographic Three.js scene that every `<Diagram>` element owns. It is not a separate DSL component — the single `<Diagram>` element is the canvas owner.

The `<Diagram>` element renders in its own isolated `OrthographicCamera` scene, separate from the main perspective camera. This orthographic scene supports:

- **Pan** — translate the diagram viewport using `diagram-canvas.move`
- **Orbit/rotate** — rotate the diagram geometry using `diagram-canvas.rotate`
- **Focus** — snap the camera to a specific 2D center point using `diagram-canvas.focus`
- **Reset** — return to default camera position using `diagram-canvas.reset`

Use the interactive canvas when you want a diagram that viewers can explore: pan around a large architecture, orbit to see depth, or click groups to zoom in on subsystems.

The orthographic camera is separate from the main scene perspective camera. A `<Camera>` in the scene DSL positions the perspective camera used for 3D models, backgrounds, etc. — it has no effect on the diagram's orthographic view. The diagram's own camera is managed by `DiagramWidget` internally.

## DiagramCanvas Input Actions

Wire canvas interactions through `<InputController>` and `<Action>` DSL components (from `@brewsite/core`). The `canvasId` on each `<Action>` must match the `<Diagram id="...">`.

Available action types:

| Action type | Effect |
|---|---|
| `diagram-canvas.move` | Pan the camera by `dx`, `dy` delta |
| `diagram-canvas.rotate` | Orbit the diagram by `dx`, `dy` delta |
| `diagram-canvas.focus` | Snap camera to `focusCenter: [x, y]` in diagram space |
| `diagram-canvas.reset` | Return camera to default position |

These action types are handled by `diagramPlugin`'s `getActionInputExtension`. They route to `DiagramWidget.applyCanvasAction()` internally.

**Standard pan + orbit + reset wiring:**

```tsx
import {
  Scene, ProgressManager, Camera, Background, Lighting, Ambient, Directional,
  InputController, Action, PointerMap, WheelMap, KeyMap,
} from '@brewsite/core';
import { Diagram, DiagramNode, DiagramEdge, HierarchicalLayout, DiagramEnter } from '@brewsite/diagram';

const CANVAS_ID = 'my-diagram';

export const SceneInteractive = () => (
  <Scene id="interactive">
    <ProgressManager scrollUnits={2000} />
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
    </Lighting>

    {/* Canvas input wiring — scope="canvas" restricts events to the diagram area */}
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId={CANVAS_ID}>
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId={CANVAS_ID}>
        {/* Meta+drag to rotate */}
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId={CANVAS_ID}>
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <Diagram id={CANVAS_ID} x={0} y={0} w={1} h={1}>
      <HierarchicalLayout direction="top-down" spacing={[3, 3]} />
      <DiagramEnter fade />

      <DiagramNode id="root" label="Root" icon="ui:server" />
      <DiagramNode id="svc-a" label="Service A" icon="tech:nodejs" />
      <DiagramNode id="svc-b" label="Service B" icon="tech:python" />
      <DiagramNode id="db" label="Database" icon="tech:postgresql" />

      <DiagramEdge from="root" to="svc-a" flow="forward" />
      <DiagramEdge from="root" to="svc-b" flow="forward" />
      <DiagramEdge from="svc-a" to="db" label="read/write" />
      <DiagramEdge from="svc-b" to="db" style="dashed" />
    </Diagram>
  </Scene>
);
```

**InputController scope options:**
- `scope="canvas"` — events captured only when pointer is over the 3D canvas area
- `scope="window"` — events captured globally (useful for keyboard shortcuts)

**`diagram-canvas.focus` with explicit center:**

The `focusCenter` extra parameter is a 2D point in diagram NVS space `[0..1]`:

```tsx
<Action
  id="focus-backend"
  type="diagram-canvas.focus"
  canvasId={CANVAS_ID}
  focusCenter={[0.6, 0.4]}  // focus point in diagram viewport NVS space
>
  <KeyMap keyName="f" />
</Action>
```

## Focus Regions

The focus region system allows React code outside the 3D scene to know what the user has focused on in the diagram. This is a pub/sub mechanism built on a `CustomEvent` dispatched on `window`.

**State shape:**

```tsx
interface DiagramFocusRegionState {
  readonly kind: 'group' | 'canvas';
  readonly canvasId: string;        // diagram id
  readonly diagramId: string | null;
  readonly groupId: string | null;
  readonly focusedAt: number;       // Date.now() timestamp
}
```

**`useDiagramFocusRegion` hook:**

Subscribe to focus region changes in any React component:

```tsx
import { useDiagramFocusRegion } from '@brewsite/diagram';

function FocusIndicator() {
  // Subscribe to all diagrams:
  const focus = useDiagramFocusRegion();

  // Or subscribe only to a specific diagram:
  const focus = useDiagramFocusRegion({ canvasId: 'my-diagram' });

  if (!focus) return <span>No focus</span>;
  if (focus.kind === 'group') return <span>Focused: {focus.groupId}</span>;
  return <span>Canvas focus</span>;
}
```

The hook returns `null` when no focus region is active. It re-renders whenever the focus region changes via the `brewsite:diagram-focus-region` window event.

**Programmatic focus region access:**

```tsx
import { getDiagramFocusRegion, clearDiagramFocusRegion, DIAGRAM_FOCUS_REGION_EVENT } from '@brewsite/diagram';

// Read current focus:
const current = getDiagramFocusRegion();

// Clear the focus region (globally):
clearDiagramFocusRegion();

// Clear only for a specific diagram:
clearDiagramFocusRegion('my-diagram');

// Listen for changes imperatively:
window.addEventListener(DIAGRAM_FOCUS_REGION_EVENT, (event) => {
  const state = (event as CustomEvent).detail; // DiagramFocusRegionState | null
  console.log('focus changed:', state);
});
```

The focus region is published by `DiagramWidget` internally when a user interacts with groups (if `clickable` is set on group nodes and the diagram has hover handlers wired). It can also be published by your own event handlers:

```tsx
import { publishDiagramFocusGroup, publishDiagramFocusCanvas } from '@brewsite/diagram';

// In a DiagramNode onMouseEnter handler — focus a specific group:
onMouseEnter={() => {
  publishDiagramFocusGroup({ id: 'my-diagram' }, 'my-diagram', 'backend-group');
}}

// Focus the whole canvas (zoom out):
publishDiagramFocusCanvas({ id: 'my-diagram' });
```

## Complete DiagramCanvas Example

A full working scene with pan, orbit, reset, keyboard focus, and a React focus-region indicator:

```tsx
import type { JSX } from 'react';
import {
  Scene, ProgressManager, Camera, Background, Lighting, Ambient, Directional,
  InputController, Action, PointerMap, WheelMap, KeyMap, TextBox,
} from '@brewsite/core';
import {
  Diagram, DiagramNode, DiagramEdge, DiagramGroup,
  DiagramEnter, ManualLayout, useDiagramFocusRegion,
} from '@brewsite/diagram';

const CANVAS_ID = 'arch-canvas';

// React component that shows focus state as a HUD overlay
function FocusStatus() {
  const focus = useDiagramFocusRegion({ canvasId: CANVAS_ID });
  return (
    <div style={{
      fontFamily: 'system-ui', fontSize: 12,
      color: 'rgba(140, 180, 255, 0.7)', padding: '8px 12px',
      background: 'rgba(0,0,10,0.6)', borderRadius: 4,
    }}>
      {focus?.kind === 'group'
        ? `Focused: ${focus.groupId}`
        : 'Drag to pan · Meta+drag to orbit · R to reset'}
    </div>
  );
}

export const SceneInteractiveArch = (): JSX.Element => (
  <Scene id="interactive-arch">
    <ProgressManager scrollUnits={1500} />
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#060810" />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#6688cc" position={[-20, 10, 10]} />
    </Lighting>

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId={CANVAS_ID}>
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="orbit" type="diagram-canvas.rotate" canvasId={CANVAS_ID}>
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId={CANVAS_ID}>
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <Diagram id={CANVAS_ID} x={0} y={0} w={1} h={0.88}>
      <ManualLayout />
      <DiagramEnter fade easing="ease" />

      <DiagramGroup id="ingress" label="Ingress" variant="boundary" color="#1a2040"
        borderStyle="dashed">
        <DiagramNode id="dns" label="Route 53" icon="aws:route53"
          position={[0.25, 0.2, 0]} size={[0.12, 0.07]} />
        <DiagramNode id="cf" label="CloudFront" icon="aws:cloudfront"
          position={[0.5, 0.2, 0]} size={[0.14, 0.07]} />
        <DiagramNode id="waf" label="WAF" icon="aws:waf"
          position={[0.75, 0.2, 0]} size={[0.10, 0.07]} />
      </DiagramGroup>

      <DiagramGroup id="compute" label="Compute" variant="cluster" color="#0a1a10">
        <DiagramNode id="alb" label="ALB" icon="aws:alb"
          position={[0.35, 0.45, 0]} size={[0.12, 0.07]} />
        <DiagramNode id="ecs" label="ECS Fargate" icon="aws:fargate"
          position={[0.65, 0.45, 0]} size={[0.14, 0.07]}
          glow={{ intensity: 0.15 }} />
      </DiagramGroup>

      <DiagramNode id="rds" label="Aurora" icon="aws:aurora"
        position={[0.5, 0.72, 0]} size={[0.14, 0.07]} color="#1a0830" />

      <DiagramEdge from="cf" to="waf" routing="flow" />
      <DiagramEdge from="waf" to="alb" flow="forward" color="#44aaff" />
      <DiagramEdge from="alb" to="ecs" flow="forward" color="#44aaff" />
      <DiagramEdge from="ecs" to="rds" flow="forward" label="SQL" color="#aa44ff" />
      <DiagramEdge from="dns" to="cf" style="dashed" color="#4488aa" />
    </Diagram>

    {/* Focus status overlay */}
    <TextBox id="focus-hint" x={0.02} y={0.9} w={0.5} h={0.08}>
      <FocusStatus />
    </TextBox>
  </Scene>
);
```
