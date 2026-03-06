---
title: Whiteboard Architecture Slide Deck
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-05
---

# Whiteboard Architecture Slide Deck

Implementation plan for a 7-scene BrewSite slide deck that recreates a whiteboard network-security architecture diagram. The deck uses `EngineProvider` + `Scene[]` (the same pattern as `apps/examples/src/architecture/`) with a `DiagramCanvas` shared across all scenes and per-scene `Camera` positions to produce zoom-in transitions.

---

## 1. Directory Structure

```
apps/examples/src/whiteboard-arch/
  WhiteboardArchPage.tsx       ← EngineProvider container, mounts plugins + scenes
  widgetSetup.ts               ← createWhiteboardArchPlugins()
  diagram.tsx                  ← makeWhiteboardDiagram(): JSX.Element (shared across scenes)
  flow.tsx                     ← whiteboardArchScenes: JSX.Element[] array
  scenes/
    scene_overview.tsx         ← Scene 1: full overview camera
    scene_client.tsx           ← Scene 2: Client area zoom
    scene_fwcloud.tsx          ← Scene 3: FW Cloud area zoom
    scene_proxy.tsx            ← Scene 4: Proxy/MITM area zoom
    scene_alb.tsx              ← Scene 5: ALB/Protocol Processing zoom
    scene_controlplane.tsx     ← Scene 6: Control Plane / AI zoom
    scene_parkinglot.tsx       ← Scene 7: Parking Lot (text HUD only)
  index.ts                     ← re-exports default WhiteboardArchPage
```

All new files are **app-layer only** — no changes to `packages/core` or `packages/diagram`.

---

## 2. Color Conventions

| Category | Hex | Usage |
|---|---|---|
| Red — current state | `#cc3333` | All components that exist today |
| Blue — future state | `#3366cc` | New capabilities being added |
| Green — control plane future | `#33aa66` | Management/update path additions |
| Background | `#0d1117` | Scene background (near-black dark blue) |

These colors are applied as the `color` prop on each `DiagramNode` and `DiagramGroup`. The `darkGlassTheme` from `@brewsite/diagram` is the base theme — per-node color overrides take precedence.

---

## 3. DiagramCanvas Setup (shared across all scenes)

**Canvas ID:** `whiteboard-arch-canvas`

The canvas is placed flat (no rotation) at the world origin. The zoom effect is achieved purely by moving the main scene `Camera` — the canvas itself never changes position between scenes.

```tsx
<DiagramCanvas
  id="whiteboard-arch-canvas"
  position={[0, 2, 0]}
  rotation={[0, 0, 0]}
  scale={1.0}
  theme={darkGlassTheme}
>
  {makeWhiteboardDiagram()}
</DiagramCanvas>
```

`makeWhiteboardDiagram()` is defined in `diagram.tsx` and imported by every scene file. It returns the single `<Diagram>` JSX tree containing all nodes, groups, and edges. Because the canvas widget caches compiled state by id, re-declaring the same canvas with identical content across scenes costs no extra Three.js work.

---

## 4. Node and Group Definitions

All node positions are in diagram-local space (z=0 throughout). The overall layout spans approximately **x: −30 to +32, y: −18 to +22** (≈62 units wide, ≈40 units tall).

### 4.1 Standalone Nodes (not inside a group)

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `fw-url-update` | FW URL Update | Pushes policy URLs to FW Cloud via EDL | `[-6, 21, 0]` | `[5.5, 2.5]` | `#33aa66` |
| `app-catalog` | App Catalog | Registry of approved applications | `[0.5, 21, 0]` | `[5, 2.5]` | `#33aa66` |
| `app-repo` | App Repo | Source-of-truth for app definitions | `[6.5, 21, 0]` | `[4.5, 2.5]` | `#33aa66` |
| `peas` | PEAS | Policy enforcement & auth service | `[-28, 7, 0]` | `[5, 3]` | `#33aa66` |
| `user-db` | User DB | User identity & credential store | `[-28, 1.5, 0]` | `[5, 2.5]` | `#33aa66` |
| `nlb` | NLB | Network Load Balancer · 8443 4128 443 80 | `[-9, -3, 0]` | `[5, 2.5]` | `#cc3333` |
| `destination` | Destination | Traffic egress endpoint | `[8, 21, 0]` | `[5, 2.5]` | `#cc3333` |
| `kong` | KONG | API Gateway (x-change) | `[29, 10, 0]` | `[5, 2.5]` | `#3366cc` |
| `atlas` | ATLAS | Analytics & aggregation store | `[29, 4.5, 0]` | `[5, 2.5]` | `#cc3333` |
| `kafka` | Kafka | Event bus & message queue | `[29, -1, 0]` | `[5, 2.5]` | `#cc3333` |
| `gr` | GR | Graph routing layer | `[29, -6.5, 0]` | `[4.5, 2.5]` | `#cc3333` |
| `isc` | ISC | Interconnect service | `[29, -12, 0]` | `[4.5, 2.5]` | `#cc3333` |
| `hook-policy` | Hook Policy (JWT) | Auth enforcement hook | `[6, -10, 0]` | `[6, 2.5]` | `#3366cc` |
| `streaming` | Streaming | Real-time data stream output | `[6, -15, 0]` | `[5, 2.5]` | `#3366cc` |
| `openai` | inputs → compile → OpenAI | AI inference pipeline | `[29, -17, 0]` | `[6.5, 2.5]` | `#3366cc` |

### 4.2 Group: `fw-cloud-group`

```tsx
<DiagramGroup
  id="fw-cloud-group"
  label="FW Cloud"
  color="#cc3333"
  variant="boundary"
>
```

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `zsl` | ZSL | Zero-trust security layer | `[-18, 8, 0]` | `[4.5, 2.5]` | `#cc3333` |
| `pa` | PA | Policy agent | `[-18, 3, 0]` | `[4.5, 2.5]` | `#cc3333` |

### 4.3 Group: `client-group`

```tsx
<DiagramGroup
  id="client-group"
  label="Client"
  color="#cc3333"
  variant="boundary"
>
```

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `wa` | WA | Web agent | `[-22, -14, 0]` | `[4, 2.5]` | `#cc3333` |
| `fc` | FC | Forward connector | `[-16, -14, 0]` | `[4, 2.5]` | `#cc3333` |

### 4.4 Group: `proxy-pod-group`

```tsx
<DiagramGroup
  id="proxy-pod-group"
  label="Proxy (S3) Pod"
  color="#cc3333"
  variant="boundary"
>
```

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `rust-mitm` | RUST MITM | Rust-based proxy interceptor | `[-1, 8, 0]` | `[5.5, 2.5]` | `#cc3333` |
| `vscode-proxy` | Vscode | Extension host in proxy pod | `[-1, 2.5, 0]` | `[5.5, 2.5]` | `#3366cc` |
| `parsolib` | Parsolib | Protocol parse library | `[-1, -3, 0]` | `[5.5, 2.5]` | `#cc3333` |

### 4.5 Group: `alb-group`

```tsx
<DiagramGroup
  id="alb-group"
  label="ALB (UDP)"
  color="#3366cc"
  variant="boundary"
>
```

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `ct-http` | CT(P/IP) / HTTP | Layer-4/7 protocol handler | `[13, 8, 0]` | `[5.5, 2.5]` | `#3366cc` |
| `icap` | ICAP | Internet content adaptation protocol | `[13, 3, 0]` | `[5, 2.5]` | `#3366cc` |
| `quix` | QUIX (WebSocket) | [DEPRECATED] Realtime WS handler | `[13, -2, 0]` | `[5.5, 2.5]` | `#3366cc` |

### 4.6 Group: `protoparser-pod-group`

```tsx
<DiagramGroup
  id="protoparser-pod-group"
  label="Protoparser Pod"
  color="#3366cc"
  variant="boundary"
>
```

| Node ID | Label | Sublabel | position | size | color |
|---|---|---|---|---|---|
| `vscode-proto` | Vscode | Extension host in protoparser pod | `[22, 6, 0]` | `[5, 2.5]` | `#3366cc` |
| `gemini` | Gemini | AI model integration | `[22, 2, 0]` | `[5, 2.5]` | `#3366cc` |

---

## 5. Edge Definitions

All edges are `<DiagramEdge>` components. Those with no label omit the `label` prop.

### Pchain connections (Red — current state)

```tsx
<DiagramEdge from="fw-cloud-group" to="nlb"          label="Pchain"  color="#cc3333" />
<DiagramEdge from="client-group"   to="nlb"          label="Pchain"  color="#cc3333" />
```

### NLB → Proxy (Red)

```tsx
<DiagramEdge from="nlb"            to="proxy-pod-group"              color="#cc3333" />
```

### EDL connections (Green — control plane to FW Cloud)

```tsx
<DiagramEdge from="fw-url-update"  to="fw-cloud-group" label="EDL"   color="#33aa66" />
<DiagramEdge from="app-catalog"    to="fw-cloud-group" label="EDL"   color="#33aa66" />
<DiagramEdge from="peas"           to="fw-cloud-group" label="EDL"   color="#33aa66" />
<DiagramEdge from="user-db"        to="fw-cloud-group" label="EDL"   color="#33aa66" />
```

### App repo feeds App Catalog (Green, dashed)

```tsx
<DiagramEdge from="app-repo"       to="app-catalog"               color="#33aa66" style="dashed" />
```

### FW Cloud current-state path to Destination (Red, dashed)

```tsx
<DiagramEdge from="fw-cloud-group" to="destination"               color="#cc3333" style="dashed" />
```

### Proxy Pod → ALB (Blue — future path)

```tsx
<DiagramEdge from="proxy-pod-group" to="alb-group"  label="HTTP/HTTPS" color="#3366cc" flow="forward" />
```

### ALB → Protoparser Pod (Blue)

```tsx
<DiagramEdge from="alb-group"       to="protoparser-pod-group"    color="#3366cc" flow="forward" />
```

### ALB → Destination (Red — routed traffic)

```tsx
<DiagramEdge from="alb-group"       to="destination"              color="#cc3333" />
```

### Protoparser Pod → KONG (Blue)

```tsx
<DiagramEdge from="protoparser-pod-group" to="kong"               color="#3366cc" flow="forward" />
```

### KONG → ATLAS (Red)

```tsx
<DiagramEdge from="kong"            to="atlas"        label="HTTP" color="#cc3333" />
```

### ATLAS → Kafka (Red)

```tsx
<DiagramEdge from="atlas"           to="kafka"                    color="#cc3333" />
```

### Kafka → GR (Red)

```tsx
<DiagramEdge from="kafka"           to="gr"                       color="#cc3333" />
```

### GR → ISC (Red)

```tsx
<DiagramEdge from="gr"              to="isc"                      color="#cc3333" />
```

### Hook Policy annotation (Blue, dashed)

```tsx
<DiagramEdge from="rust-mitm"       to="hook-policy"              color="#3366cc" style="dashed" />
```

### Streaming annotation (Blue, dashed)

```tsx
<DiagramEdge from="proxy-pod-group" to="streaming"                color="#3366cc" style="dashed" />
```

### OpenAI pipeline (Blue)

```tsx
<DiagramEdge from="atlas"           to="openai"                   color="#3366cc" flow="forward" />
```

---

## 6. `diagram.tsx` — Complete Structure

**File:** `apps/examples/src/whiteboard-arch/diagram.tsx`

**Single responsibility:** Export `makeWhiteboardDiagram(): JSX.Element` containing the full `<Diagram>` tree.

```tsx
import type { JSX } from 'react';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  ManualLayout,
} from '@brewsite/diagram';

export function makeWhiteboardDiagram(): JSX.Element {
  return (
    <Diagram id="whiteboard-arch-diagram" pivot="center">
      <ManualLayout />

      {/* ── Standalone nodes ── */}
      {/* Green control plane (top) */}
      <DiagramNode id="fw-url-update" label="FW URL Update"
        sublabel="Pushes policy URLs to FW Cloud via EDL"
        position={[-6, 21, 0]} size={[5.5, 2.5]} color="#33aa66" />
      <DiagramNode id="app-catalog" label="App Catalog"
        sublabel="Registry of approved applications"
        position={[0.5, 21, 0]} size={[5, 2.5]} color="#33aa66" />
      <DiagramNode id="app-repo" label="App Repo"
        sublabel="Source-of-truth for app definitions"
        position={[6.5, 21, 0]} size={[4.5, 2.5]} color="#33aa66" />

      {/* Green PEAS / User DB (far left) */}
      <DiagramNode id="peas" label="PEAS"
        sublabel="Policy enforcement & auth service"
        position={[-28, 7, 0]} size={[5, 3]} color="#33aa66" />
      <DiagramNode id="user-db" label="User DB"
        sublabel="User identity & credential store"
        position={[-28, 1.5, 0]} size={[5, 2.5]} color="#33aa66" />

      {/* Red NLB + Destination */}
      <DiagramNode id="nlb" label="NLB"
        sublabel="Network Load Balancer · 8443 · 4128 · 443 · 80"
        position={[-9, -3, 0]} size={[5, 2.5]} color="#cc3333" />
      <DiagramNode id="destination" label="Destination"
        sublabel="Traffic egress endpoint"
        position={[8, 21, 0]} size={[5, 2.5]} color="#cc3333" />

      {/* Blue future right-side standalone nodes */}
      <DiagramNode id="kong" label="KONG"
        sublabel="API Gateway (x-change)"
        position={[29, 10, 0]} size={[5, 2.5]} color="#3366cc" />
      <DiagramNode id="atlas" label="ATLAS"
        sublabel="Analytics & aggregation store"
        position={[29, 4.5, 0]} size={[5, 2.5]} color="#cc3333" />
      <DiagramNode id="kafka" label="Kafka"
        sublabel="Event bus & message queue"
        position={[29, -1, 0]} size={[5, 2.5]} color="#cc3333" />
      <DiagramNode id="gr" label="GR"
        sublabel="Graph routing layer"
        position={[29, -6.5, 0]} size={[4.5, 2.5]} color="#cc3333" />
      <DiagramNode id="isc" label="ISC"
        sublabel="Interconnect service"
        position={[29, -12, 0]} size={[4.5, 2.5]} color="#cc3333" />

      {/* Blue annotations */}
      <DiagramNode id="hook-policy" label="Hook Policy (JWT)"
        sublabel="Auth enforcement hook"
        position={[6, -10, 0]} size={[6, 2.5]} color="#3366cc" />
      <DiagramNode id="streaming" label="Streaming"
        sublabel="Real-time data stream output"
        position={[6, -15, 0]} size={[5, 2.5]} color="#3366cc" />
      <DiagramNode id="openai" label="inputs → compile → OpenAI"
        sublabel="AI inference pipeline"
        position={[29, -17, 0]} size={[6.5, 2.5]} color="#3366cc" />

      {/* ── FW Cloud group (Red) ── */}
      <DiagramGroup id="fw-cloud-group" label="FW Cloud" color="#cc3333" variant="boundary">
        <DiagramNode id="zsl" label="ZSL"
          sublabel="Zero-trust security layer"
          position={[-18, 8, 0]} size={[4.5, 2.5]} color="#cc3333" />
        <DiagramNode id="pa" label="PA"
          sublabel="Policy agent"
          position={[-18, 3, 0]} size={[4.5, 2.5]} color="#cc3333" />
      </DiagramGroup>

      {/* ── Client group (Red) ── */}
      <DiagramGroup id="client-group" label="Client" color="#cc3333" variant="boundary">
        <DiagramNode id="wa" label="WA"
          sublabel="Web agent"
          position={[-22, -14, 0]} size={[4, 2.5]} color="#cc3333" />
        <DiagramNode id="fc" label="FC"
          sublabel="Forward connector"
          position={[-16, -14, 0]} size={[4, 2.5]} color="#cc3333" />
      </DiagramGroup>

      {/* ── Proxy (S3) Pod group (Red + Blue mixed) ── */}
      <DiagramGroup id="proxy-pod-group" label="Proxy (S3) Pod" color="#cc3333" variant="boundary">
        <DiagramNode id="rust-mitm" label="RUST MITM"
          sublabel="Rust-based proxy interceptor"
          position={[-1, 8, 0]} size={[5.5, 2.5]} color="#cc3333" />
        <DiagramNode id="vscode-proxy" label="Vscode"
          sublabel="Extension host in proxy pod"
          position={[-1, 2.5, 0]} size={[5.5, 2.5]} color="#3366cc" />
        <DiagramNode id="parsolib" label="Parsolib"
          sublabel="Protocol parse library"
          position={[-1, -3, 0]} size={[5.5, 2.5]} color="#cc3333" />
      </DiagramGroup>

      {/* ── ALB (UDP) group (Blue) ── */}
      <DiagramGroup id="alb-group" label="ALB (UDP)" color="#3366cc" variant="boundary">
        <DiagramNode id="ct-http" label="CT(P/IP) / HTTP"
          sublabel="Layer-4/7 protocol handler"
          position={[13, 8, 0]} size={[5.5, 2.5]} color="#3366cc" />
        <DiagramNode id="icap" label="ICAP"
          sublabel="Internet content adaptation protocol"
          position={[13, 3, 0]} size={[5, 2.5]} color="#3366cc" />
        <DiagramNode id="quix" label="QUIX (WebSocket)"
          sublabel="[DEPRECATED] Realtime WS handler"
          position={[13, -2, 0]} size={[5.5, 2.5]} color="#3366cc" />
      </DiagramGroup>

      {/* ── Protoparser Pod group (Blue) ── */}
      <DiagramGroup id="protoparser-pod-group" label="Protoparser Pod" color="#3366cc" variant="boundary">
        <DiagramNode id="vscode-proto" label="Vscode"
          sublabel="Extension host in protoparser pod"
          position={[22, 6, 0]} size={[5, 2.5]} color="#3366cc" />
        <DiagramNode id="gemini" label="Gemini"
          sublabel="AI model integration"
          position={[22, 2, 0]} size={[5, 2.5]} color="#3366cc" />
      </DiagramGroup>

      {/* ── Edges ── */}

      {/* Pchain (Red) */}
      <DiagramEdge from="fw-cloud-group" to="nlb"               label="Pchain"     color="#cc3333" />
      <DiagramEdge from="client-group"   to="nlb"               label="Pchain"     color="#cc3333" />

      {/* NLB to Proxy (Red) */}
      <DiagramEdge from="nlb"            to="proxy-pod-group"                      color="#cc3333" />

      {/* EDL connections (Green) */}
      <DiagramEdge from="fw-url-update"  to="fw-cloud-group"    label="EDL"        color="#33aa66" />
      <DiagramEdge from="app-catalog"    to="fw-cloud-group"    label="EDL"        color="#33aa66" />
      <DiagramEdge from="peas"           to="fw-cloud-group"    label="EDL"        color="#33aa66" />
      <DiagramEdge from="user-db"        to="fw-cloud-group"    label="EDL"        color="#33aa66" />

      {/* App Repo → App Catalog (Green, dashed) */}
      <DiagramEdge from="app-repo"       to="app-catalog"                          color="#33aa66" style="dashed" />

      {/* FW Cloud current path to Destination (Red, dashed — legacy) */}
      <DiagramEdge from="fw-cloud-group" to="destination"                          color="#cc3333" style="dashed" />

      {/* Proxy → ALB (Blue — future HTTP forward path) */}
      <DiagramEdge from="proxy-pod-group" to="alb-group"        label="HTTP/HTTPS" color="#3366cc" flow="forward" />

      {/* ALB → Protoparser Pod (Blue) */}
      <DiagramEdge from="alb-group"       to="protoparser-pod-group"               color="#3366cc" flow="forward" />

      {/* ALB → Destination (Red — routed traffic) */}
      <DiagramEdge from="alb-group"       to="destination"                         color="#cc3333" />

      {/* Protoparser Pod → KONG (Blue) */}
      <DiagramEdge from="protoparser-pod-group" to="kong"                          color="#3366cc" flow="forward" />

      {/* KONG → ATLAS (Red) */}
      <DiagramEdge from="kong"            to="atlas"            label="HTTP"       color="#cc3333" />

      {/* ATLAS → Kafka → GR → ISC (Red) */}
      <DiagramEdge from="atlas"           to="kafka"                               color="#cc3333" />
      <DiagramEdge from="kafka"           to="gr"                                  color="#cc3333" />
      <DiagramEdge from="gr"              to="isc"                                 color="#cc3333" />

      {/* Hook Policy + Streaming annotations (Blue, dashed) */}
      <DiagramEdge from="rust-mitm"       to="hook-policy"                         color="#3366cc" style="dashed" />
      <DiagramEdge from="proxy-pod-group" to="streaming"                           color="#3366cc" style="dashed" />

      {/* OpenAI pipeline (Blue) */}
      <DiagramEdge from="atlas"           to="openai"                              color="#3366cc" flow="forward" />
    </Diagram>
  );
}
```

---

## 7. Lighting (shared across all scenes)

All 7 scenes use the same lighting block. Define it once in each scene file (copy-paste is intentional — no shared function needed for a trivial constant).

```tsx
<Lighting intensityScale={1}>
  <Ambient intensity={1.0} color="#ffffff" />
  <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
  <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
</Lighting>
```

---

## 8. Scene Specifications

All seven scenes share identical imports:

```tsx
import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import { darkGlassTheme, DiagramCanvas } from '@brewsite/diagram';
import { makeWhiteboardDiagram } from '../diagram';
```

### 8.1 Scene 1 — Overview (`scene_overview.tsx`)

**Purpose:** Zoomed-out view of the complete architecture. All components visible simultaneously.

**Camera:** Position far enough back to contain the full layout (x: −30 to +32, y: −18 to +22, center ≈ [1, 2]).

```tsx
export const sceneWhiteboardOverview: JSX.Element = (
  <Scene id="whiteboard-overview">
    <ProgressManager scrollUnits={2500} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[1, 2, 68]}
      target={[1, 2, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="overview-title" x={0.03} y={0.03} w={0.38} h={0.12}>
      <div style={{
        padding: '16px 20px',
        background: 'rgba(13,17,23,0.82)',
        backdropFilter: 'blur(12px)',
        borderLeft: '3px solid rgba(200,200,200,0.4)',
        borderRadius: '2px',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(200,200,200,0.5)', marginBottom: 6 }}>
          Network Security Architecture
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '18px', fontWeight: 700,
          color: '#f0f6fc', lineHeight: 1.3 }}>
          Full Overview
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '12px', color: 'rgba(240,246,252,0.5)',
          marginTop: 6 }}>
          <span style={{ color: '#cc3333' }}>■</span> Current&nbsp;&nbsp;
          <span style={{ color: '#3366cc' }}>■</span> Future&nbsp;&nbsp;
          <span style={{ color: '#33aa66' }}>■</span> Control Plane
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.2 Scene 2 — Client Area (`scene_client.tsx`)

**Focal nodes:** `client-group` (wa, fc), `nlb`
**Focus bounds:** x: −28 to −6, y: −18 to −1 → center ≈ [−17, −9.5]

```tsx
export const sceneWhiteboardClient: JSX.Element = (
  <Scene id="whiteboard-client">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[-17, -9, 30]}
      target={[-17, -9, 0]}
      fov={45}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="client-overlay" x={0.63} y={0.03} w={0.34} h={0.28}>
      <div style={{
        padding: '18px 22px',
        background: 'rgba(13,17,23,0.88)',
        backdropFilter: 'blur(14px)',
        borderLeft: '3px solid #cc3333',
        borderRadius: '2px',
        height: '100%',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#cc5555', marginBottom: 8 }}>
          Current State
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 10 }}>
          Client Area
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(240,246,252,0.7)',
          lineHeight: 1.6 }}>
          WA (web agent) and FC (forward connector) live inside the Client boundary.
          Both connect outbound via Pchain to the NLB, which load-balances across ports
          8443, 4128, 443, and 80 into the Proxy Pod.
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.3 Scene 3 — FW Cloud Area (`scene_fwcloud.tsx`)

**Focal nodes:** `fw-cloud-group` (zsl, pa), `fw-url-update`, `app-catalog`, `app-repo`, `peas`, `user-db`
**Focus bounds:** x: −32 to +10, y: −2 to +22 → center ≈ [−11, 10]

```tsx
export const sceneWhiteboardFwCloud: JSX.Element = (
  <Scene id="whiteboard-fwcloud">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[-11, 11, 38]}
      target={[-11, 11, 0]}
      fov={50}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="fwcloud-overlay" x={0.63} y={0.03} w={0.34} h={0.35}>
      <div style={{
        padding: '18px 22px',
        background: 'rgba(13,17,23,0.88)',
        backdropFilter: 'blur(14px)',
        borderLeft: '3px solid #cc3333',
        borderRadius: '2px',
        height: '100%',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#cc5555', marginBottom: 8 }}>
          Current + Future Control Plane
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 10 }}>
          FW Cloud
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(240,246,252,0.7)',
          lineHeight: 1.6 }}>
          ZSL and PA run inside FW Cloud today. Three green control-plane paths deliver
          policy updates via EDL: FW URL Update pushes URL lists, App Catalog registers
          approved apps (fed by App Repo), and PEAS + User DB provide identity enforcement.
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.4 Scene 4 — Proxy / MITM Area (`scene_proxy.tsx`)

**Focal nodes:** `nlb`, `proxy-pod-group` (rust-mitm, vscode-proxy, parsolib), `hook-policy`, `streaming`
**Focus bounds:** x: −14 to +12, y: −17 to +12 → center ≈ [−1, −2.5]

```tsx
export const sceneWhiteboardProxy: JSX.Element = (
  <Scene id="whiteboard-proxy">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[-1, -2, 34]}
      target={[-1, -2, 0]}
      fov={48}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="proxy-overlay" x={0.63} y={0.03} w={0.34} h={0.42}>
      <div style={{
        padding: '18px 22px',
        background: 'rgba(13,17,23,0.88)',
        backdropFilter: 'blur(14px)',
        borderLeft: '3px solid #cc3333',
        borderRadius: '2px',
        height: '100%',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#cc5555', marginBottom: 8 }}>
          Current + Future
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 10 }}>
          Proxy (S3) Pod
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(240,246,252,0.7)',
          lineHeight: 1.6 }}>
          NLB fans traffic across ports <strong style={{ color: '#f0f6fc' }}>8443 · 4128 · 443 · 80</strong>.
          RUST MITM intercepts and inspects; Parsolib handles protocol parsing today.
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(51,102,204,0.9)',
          lineHeight: 1.6, marginTop: 10 }}>
          Future additions: Vscode extension host (blue), Hook Policy (JWT) enforcement,
          and a Streaming output path for real-time data.
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.5 Scene 5 — ALB / Protocol Processing (`scene_alb.tsx`)

**Focal nodes:** `alb-group` (ct-http, icap, quix), `protoparser-pod-group` (vscode-proto, gemini), `destination`
**Focus bounds:** x: +6 to +30, y: −4 to +22 → center ≈ [18, 9]

```tsx
export const sceneWhiteboardAlb: JSX.Element = (
  <Scene id="whiteboard-alb">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[18, 9, 32]}
      target={[18, 9, 0]}
      fov={46}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="alb-overlay" x={0.03} y={0.03} w={0.36} h={0.42}>
      <div style={{
        padding: '18px 22px',
        background: 'rgba(13,17,23,0.88)',
        backdropFilter: 'blur(14px)',
        borderLeft: '3px solid #3366cc',
        borderRadius: '2px',
        height: '100%',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#5588ee', marginBottom: 8 }}>
          Future State
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 10 }}>
          ALB (UDP) + Protoparser
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(240,246,252,0.7)',
          lineHeight: 1.6 }}>
          ALB (UDP) introduces protocol-aware load balancing:
          CT(P/IP)/HTTP for Layer-4/7, ICAP for content adaptation.
          QUIX/WebSocket is deprecated (crossed out on whiteboard).
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(51,102,204,0.9)',
          lineHeight: 1.6, marginTop: 10 }}>
          Protoparser Pod adds Vscode extension host + Gemini AI for
          protocol intelligence, routing parsed traffic to KONG.
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.6 Scene 6 — Control Plane / AI (`scene_controlplane.tsx`)

**Focal nodes:** `kong`, `atlas`, `kafka`, `gr`, `isc`, `openai`
**Focus bounds:** x: +24 to +35, y: −19 to +13 → center ≈ [29.5, −3]

```tsx
export const sceneWhiteboardControlPlane: JSX.Element = (
  <Scene id="whiteboard-controlplane">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[29, -3, 32]}
      target={[29, -3, 0]}
      fov={42}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="controlplane-overlay" x={0.03} y={0.03} w={0.38} h={0.50}>
      <div style={{
        padding: '18px 22px',
        background: 'rgba(13,17,23,0.88)',
        backdropFilter: 'blur(14px)',
        borderLeft: '3px solid #3366cc',
        borderRadius: '2px',
        height: '100%',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#5588ee', marginBottom: 8 }}>
          Current + Future
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 10 }}>
          Control Plane / AI
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(240,246,252,0.7)',
          lineHeight: 1.7 }}>
          <strong style={{ color: '#cc3333' }}>Today:</strong> KONG routes to ATLAS via HTTP.
          ATLAS feeds Kafka → GR → ISC for graph routing and interconnect.
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '13px', color: 'rgba(51,102,204,0.9)',
          lineHeight: 1.7, marginTop: 10 }}>
          <strong style={{ color: '#3366cc' }}>Future:</strong> KONG gains x-change capability.
          ATLAS gains an AI pipeline: inputs → compile → OpenAI.
          JSON/XML/Protobuf data formats with structured user/system/sem fields.
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

### 8.7 Scene 7 — Parking Lot (`scene_parkinglot.tsx`)

**Purpose:** Text-only overlay listing 7 open items. The diagram is visible at overview zoom in the background for context. No zoom — stays at overview camera position.

```tsx
export const sceneWhiteboardParkingLot: JSX.Element = (
  <Scene id="whiteboard-parkinglot">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera
      mode="world"
      position={[1, 2, 68]}
      target={[1, 2, 0]}
      fov={54}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>

    <TextBox id="parkinglot-overlay" x={0.08} y={0.06} w={0.84} h={0.86}>
      <div style={{
        padding: '36px 48px',
        background: 'rgba(13,17,23,0.92)',
        backdropFilter: 'blur(20px)',
        borderRadius: '4px',
        border: '1px solid rgba(51,102,204,0.3)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#5588ee', marginBottom: 10 }}>
          Parking Lot
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '28px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 28 }}>
          Open Items
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px 32px',
          flex: 1,
        }}>
          {[
            { n: 1, text: 'Letting folks have agency' },
            { n: 2, text: 'AI Spend' },
            { n: 3, text: 'Multiten for POC' },
            { n: 4, text: 'Tenant Monitoring / Alerting' },
            { n: 5, text: 'Deals lost' },
            { n: 6, text: 'Summer interns?' },
            { n: 7, text: 'Reasoning guardrails' },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                minWidth: 28, height: 28,
                borderRadius: '50%',
                background: 'rgba(51,102,204,0.25)',
                border: '1px solid rgba(51,102,204,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'system-ui', fontSize: '13px', fontWeight: 700,
                color: '#7799dd',
              }}>
                {n}
              </div>
              <div style={{
                fontFamily: 'system-ui', fontSize: '18px',
                color: 'rgba(240,246,252,0.85)', lineHeight: 1.4, paddingTop: 3,
              }}>
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TextBox>
  </Scene>
);
```

---

## 9. `flow.tsx`

**File:** `apps/examples/src/whiteboard-arch/flow.tsx`

```tsx
import type { JSX } from 'react';
import { Fragment } from 'react';
import { sceneWhiteboardOverview } from './scenes/scene_overview';
import { sceneWhiteboardClient } from './scenes/scene_client';
import { sceneWhiteboardFwCloud } from './scenes/scene_fwcloud';
import { sceneWhiteboardProxy } from './scenes/scene_proxy';
import { sceneWhiteboardAlb } from './scenes/scene_alb';
import { sceneWhiteboardControlPlane } from './scenes/scene_controlplane';
import { sceneWhiteboardParkingLot } from './scenes/scene_parkinglot';

export const whiteboardArchScenes: JSX.Element[] = [
  <Fragment key="whiteboard-overview">{sceneWhiteboardOverview}</Fragment>,
  <Fragment key="whiteboard-client">{sceneWhiteboardClient}</Fragment>,
  <Fragment key="whiteboard-fwcloud">{sceneWhiteboardFwCloud}</Fragment>,
  <Fragment key="whiteboard-proxy">{sceneWhiteboardProxy}</Fragment>,
  <Fragment key="whiteboard-alb">{sceneWhiteboardAlb}</Fragment>,
  <Fragment key="whiteboard-controlplane">{sceneWhiteboardControlPlane}</Fragment>,
  <Fragment key="whiteboard-parkinglot">{sceneWhiteboardParkingLot}</Fragment>,
];
```

---

## 10. `widgetSetup.ts`

**File:** `apps/examples/src/whiteboard-arch/widgetSetup.ts`

```typescript
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the whiteboard architecture scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createWhiteboardArchPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        canvases: ['whiteboard-arch-canvas'],
      }),
    ],
  };
}
```

**Note:** `diagramPlugin` must be called with the canvas ID `'whiteboard-arch-canvas'` before any `WidgetRegistry` is created. `EngineProvider` handles this ordering — no manual call needed.

---

## 11. `WhiteboardArchPage.tsx`

**File:** `apps/examples/src/whiteboard-arch/WhiteboardArchPage.tsx`

```tsx
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  EngineARContainer,
  EngineInputRegion,
  EngineOverlayHost,
  EngineProvider,
  SceneCanvas,
} from '@brewsite/core';
import { createWhiteboardArchPlugins } from './widgetSetup';
import { whiteboardArchScenes } from './flow';

const MANIFEST_URL = '/scene-manifest.json';

export default function WhiteboardArchPage(): JSX.Element {
  const { plugins } = useMemo(() => createWhiteboardArchPlugins(), []);

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <EngineProvider
        manifestUrl={MANIFEST_URL}
        plugins={plugins}
        pixelsPerScene={1400}
        inputModePolicy="prefer-scroll"
      >
        {whiteboardArchScenes}
        <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
          <EngineInputRegion>
            <SceneCanvas />
            <EngineOverlayHost />
          </EngineInputRegion>
        </EngineARContainer>
      </EngineProvider>
    </div>
  );
}
```

---

## 12. `index.ts`

**File:** `apps/examples/src/whiteboard-arch/index.ts`

```typescript
export { default } from './WhiteboardArchPage';
```

---

## 13. `App.tsx` Changes

**File:** `apps/examples/src/App.tsx`

Add a lazy import, a `<Route>`, and a menu list item.

**Add import (after existing lazy imports):**
```tsx
const WhiteboardArchPage = lazy(() => import('./whiteboard-arch/WhiteboardArchPage'));
```

**Add route (inside `<Routes>`, before the index route):**
```tsx
<Route path="/whiteboard-arch" element={<WhiteboardArchPage />} />
```

**Add menu list item (in the `<ul>` on the index route):**
```html
<li><a href="/examples/whiteboard-arch">Whiteboard Architecture</a></li>
```

---

## 14. ProgressManager Summary

| Scene | ID | scrollUnits | Notes |
|---|---|---|---|
| Overview | `whiteboard-overview` | 2500 | Enough time to read the full diagram |
| Client | `whiteboard-client` | 2000 | |
| FW Cloud | `whiteboard-fwcloud` | 2000 | |
| Proxy / MITM | `whiteboard-proxy` | 2000 | |
| ALB | `whiteboard-alb` | 2000 | |
| Control Plane | `whiteboard-controlplane` | 2000 | |
| Parking Lot | `whiteboard-parkinglot` | 2000 | |

---

## 15. Camera Summary Table

| Scene | position | target | fov | Focal area |
|---|---|---|---|---|
| Overview | `[1, 2, 68]` | `[1, 2, 0]` | 54 | Full diagram |
| Client | `[-17, -9, 30]` | `[-17, -9, 0]` | 45 | WA, FC, NLB |
| FW Cloud | `[-11, 11, 38]` | `[-11, 11, 0]` | 50 | FW Cloud, PEAS, Control Plane top |
| Proxy | `[-1, -2, 34]` | `[-1, -2, 0]` | 48 | NLB, Proxy Pod, Hook Policy, Streaming |
| ALB | `[18, 9, 32]` | `[18, 9, 0]` | 46 | ALB, Protoparser Pod, Destination |
| Control Plane | `[29, -3, 32]` | `[29, -3, 0]` | 42 | KONG, ATLAS, Kafka, GR, ISC, OpenAI |
| Parking Lot | `[1, 2, 68]` | `[1, 2, 0]` | 54 | Full diagram (background) |

Camera z-distance and fov may need tuning in the browser. Decrease `z` to zoom in; increase `fov` to widen. The combination `(z=30, fov=45)` and `(z=34, fov=48)` are good starting points for focused areas.

---

## 16. Test Strategy

No new library code is introduced. All new files are in `apps/examples/src/whiteboard-arch/` — application code outside the coverage boundary.

**Verification steps for the implementing developer:**

1. `pnpm typecheck` from repo root — must pass with zero errors. TypeScript strict mode catches missing imports, wrong prop types on `DiagramNode`/`DiagramEdge`/`DiagramGroup`, and invalid `Camera` mode strings.

2. `pnpm dev` then navigate to `/examples/whiteboard-arch` — confirm:
   - All 7 scenes scroll through in sequence.
   - Overview scene shows all nodes with correct red/blue/green colors.
   - Each zoom scene shows the correct focal area without clipping important nodes.
   - Camera transitions (auto-interpolated between scenes by the BrewSite runtime) are smooth.
   - Parking lot overlay is readable and all 7 items are listed.
   - TextBox overlays do not obscure focal nodes in each scene.

3. Adjust camera `z` and `fov` values per scene as needed after visual review. The values in this plan are calculated estimates; browser feedback is the authoritative source.

4. No unit tests needed — this is declarative scene authoring with no business logic or new widget code.

---

## 17. Dependency Boundaries — Confirmation

This implementation respects all hard boundary rules:

- **`@brewsite/diagram` → `@brewsite/core`**: maintained. `diagram.tsx` imports from `@brewsite/diagram` only.
- **`@brewsite/core` never imports `@brewsite/diagram`**: no new library code touches `packages/core`.
- All scene files are in `apps/examples/` — application layer, not library layer.
- No new `NodeHandler` registrations needed — `diagramPlugin()` handles all diagram DSL routing.
- `MANIFEST_URL = '/scene-manifest.json'` is the existing convention for the examples app asset manifest.

---

## 18. Implementation Order

A developer implementing this plan should work in this order to minimize wasted context-switching:

1. Create `diagram.tsx` — all nodes, groups, edges. This is the most complex file.
2. Create `widgetSetup.ts`.
3. Create `scenes/scene_overview.tsx` — simplest scene, validates that the canvas renders.
4. Run `pnpm dev` and navigate to a temporary route to see the overview.
5. Create remaining 6 scene files in order (client → fwcloud → proxy → alb → controlplane → parkinglot).
6. Create `flow.tsx` and `WhiteboardArchPage.tsx`.
7. Create `index.ts`.
8. Update `App.tsx` with the lazy import, route, and menu item.
9. Run full typecheck: `pnpm typecheck`.
10. Visual review: confirm colors, layout, and TextBox positioning.
