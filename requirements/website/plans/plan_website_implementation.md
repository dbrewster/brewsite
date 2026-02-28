---
title: "BrewSite Website Implementation Plan"
doc_type: plan
status: approved
owner: Toolkit Product
last_updated: 2026-02-28
---

# BrewSite Website Implementation Plan

## Context

This plan implements the `apps/website` landing page as specified in `requirements/website/prd/prd_website_landing.md`. It is a single-page, long-scroll marketing site for `@brewsite/core` and `@brewsite/diagram`, built using the toolkit itself to demonstrate its capabilities.

The site has 8 acts:
- **Act 0**: Hero — neon sign (Three.js + CSS)
- **Acts 1–2**: Shared ScenePlayer — HUD/Core (4 scenes)
- **Act 3**: ScenePlayer — Models (2 scenes)
- **Act 4**: ScenePlayer — Meeting crowd (1 scene)
- **Acts 5–6**: Shared ScenePlayer — Diagrams (3 scenes)
- **Act 7**: ScenePlayer — Full stack (2 scenes)
- **Act 8**: GitHub CTA (CSS only)

---

## Phase 0: Infrastructure Fixes (DO FIRST — blocks everything)

### 0.1 Fix `apps/website/vite.config.ts`

Current root is `'vite-app'` which doesn't exist. Change to `'src'`.

**File:** `apps/website/vite.config.ts`

Replace entire file with:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: [
      {
        find: /^@brewsite\/core\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/core/src/$1'),
      },
      {
        find: /^@brewsite\/diagram\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/diagram/src/$1'),
      },
      {
        find: '@brewsite/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: '@brewsite/diagram',
        replacement: resolve(__dirname, '../../packages/diagram/src/index.ts'),
      },
    ],
  },
  server: {
    host: true,
    port: 5174,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  publicDir: resolve(__dirname, 'public'),
});
```

Note: port changed to 5174 to avoid conflict with examples (5173).

### 0.2 Update `apps/website/package.json`

Add missing dependencies. Replace with:

```json
{
  "name": "@brewsite/website",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b tsconfig.json && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "gen:scene-dsl": "node ../../scripts/gen-scene-dsl.mjs --input ../website/siteResources.ts --out-dir src/generated --asset-root public --manifest-out public/scene-manifest.json"
  },
  "dependencies": {
    "@brewsite/core": "workspace:*",
    "@brewsite/diagram": "workspace:*",
    "animejs": "^3.2.2",
    "fflate": "^0.8.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router": "^7.0.0",
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.169.0",
    "@vitejs/plugin-react": "^4.7.0",
    "vitest": "^2.1.9",
    "typescript": "^5.9.3",
    "vite": "^5.4.21"
  }
}
```

Run `pnpm install` from repo root after this change.

### 0.3 Update `apps/website/src/index.html`

Replace entire file with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BrewSite — Author in JSX. Ship to any surface.</title>
    <meta name="description" content="BrewSite is a TypeScript + React + Three.js toolkit for authoring scroll-driven 3D scenes, immersive diagrams, and animated presentations." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=block"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

### 0.4 Update `apps/website/src/main.tsx`

Replace with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './style.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

### 0.5 Update `apps/website/src/App.tsx`

Replace with:

```tsx
import type { JSX } from 'react';
import { Route, Routes } from 'react-router';
import LandingPage from './landing/LandingPage';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
}
```

### 0.6 Create `apps/website/src/widgetSetup.ts`

```typescript
import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';

export const createWidgetSetup = (manifest: AssetManifest) =>
  createDefaultWidgetRegistry(manifest);
```

### 0.7 Populate `apps/website/public/assets/`

Create the `public/assets/` directory and populate it with the same model + animation GLBs used in `apps/examples/public/assets/`. The implementing engineer must copy or symlink these files:

```
public/assets/robot.no-normals.glb
public/assets/uniform-m-0021.with-normals.glb     (Worker)
public/assets/motion-dummy_female.no-normals.glb   (FemaleDummy)
public/assets/motion-dummy_male.no-normals.glb     (MaleDummy)
public/assets/business-f-0057.with-normals.glb
public/assets/business-f-0060.with-normals.glb
... (all business-f and business-m models matching siteResources.ts)
public/assets/brain_separated.glb
public/assets/motion/chat-relax-f.glb
public/assets/motion/chat-relax-m.glb
public/assets/motion/chat-talkandlaugh-f.glb
public/assets/motion/chat-talkandlaugh-m.glb
public/assets/motion/chat-listen-f.glb
public/assets/motion/chat-response-f.glb
public/assets/motion/discuss-query-m.glb
public/assets/motion/discuss-respond-f.glb
public/assets/motion/discuss-whisper-m.glb
public/assets/motion/standing_chat_m_270753.glb
public/assets/motion/standing_discuss_m_270744.glb
```

Simplest approach (macOS): `ln -s ../examples/public/assets apps/website/public/assets`

### 0.8 Generate Scene Manifest

After the above steps, run:
```
pnpm --filter @brewsite/website gen:scene-dsl
```
This generates `apps/website/public/scene-manifest.json` and `apps/website/src/generated/`.

---

## Phase 1: CSS Design System

**File:** `apps/website/src/style.css`

Replace the existing minimal CSS with the full design system:

```css
/* ─── Reset ─────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  color-scheme: dark;
}

html, body, #root {
  min-height: 100%;
  overscroll-behavior: none;
}

body {
  background: var(--bg-void);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Design Tokens ──────────────────────────────────────────────────────── */
:root {
  /* Backgrounds */
  --bg-void:      #030508;
  --bg-deep:      #060810;
  --bg-surface:   #0d1117;
  --bg-elevated:  #161b22;

  /* Metal tones */
  --metal-dark:    #131820;
  --metal-mid:     #2d3748;
  --metal-light:   #4a5568;
  --metal-shine:   #6b7a92;
  --rivet-bg:      #1e2533;

  /* Neon palette */
  --neon-cyan:     #00f5ff;
  --neon-cyan-15:  rgba(0, 245, 255, 0.15);
  --neon-cyan-30:  rgba(0, 245, 255, 0.30);
  --neon-cyan-glow: rgba(0, 245, 255, 0.55);
  --neon-blue:     #0066ff;
  --neon-pink:     #ff00aa;
  --neon-green:    #00ff88;
  --neon-amber:    #ffaa00;

  /* Text */
  --text-primary:   #f0f6fc;
  --text-secondary: #8b949e;
  --text-muted:     #4d5566;
  --text-code-blue: #79c0ff;
  --text-code-orange: #ffa657;
  --text-code-red:    #ff7b72;
  --text-code-grey:   #6e7681;
  --text-accent:    var(--neon-cyan);

  /* Typography */
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  --font-display: 'Dancing Script', cursive;

  /* Spacing */
  --section-pad-x: clamp(24px, 6vw, 96px);
  --section-pad-y: clamp(60px, 9vh, 140px);

  /* Borders */
  --border-dim:  1px solid rgba(255, 255, 255, 0.07);
  --border-mid:  1px solid rgba(255, 255, 255, 0.12);
  --border-glow: 1px solid rgba(0, 245, 255, 0.22);
}

/* ─── Typography Utilities ───────────────────────────────────────────────── */
.eyebrow {
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.eyebrow--accent {
  color: var(--neon-cyan);
  opacity: 0.8;
}

.display-headline {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.body-text {
  font-size: 17px;
  line-height: 1.65;
  color: var(--text-secondary);
}

/* ─── Feature Tag Pills ──────────────────────────────────────────────────── */
.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.feature-tag {
  padding: 5px 14px;
  border-radius: 4px;
  border: 1px solid var(--neon-cyan-30);
  background: var(--neon-cyan-15);
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--neon-cyan);
  white-space: nowrap;
}

/* ─── Code Snippets ──────────────────────────────────────────────────────── */
.code-block {
  background: var(--bg-surface);
  border: var(--border-dim);
  border-radius: 8px;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}

.code-block__header {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: var(--border-dim);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.code-block__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--metal-mid);
}
.code-block__dot--red    { background: #ff5f57; }
.code-block__dot--yellow { background: #febc2e; }
.code-block__dot--green  { background: #28c840; }

.code-block__body {
  padding: 16px 18px;
  overflow-x: auto;
  white-space: pre;
}

/* Syntax token colors */
.tok-keyword { color: var(--text-code-red); }
.tok-prop    { color: var(--text-code-blue); }
.tok-string  { color: var(--text-code-orange); }
.tok-jsx     { color: var(--text-code-grey); }
.tok-comment { color: var(--text-muted); font-style: italic; }
.tok-fn      { color: #d2a8ff; }

/* ─── Metal Surface Mixin ────────────────────────────────────────────────── */
.metal-surface {
  background:
    linear-gradient(160deg, rgba(255,255,255,0.04) 0%, transparent 35%, rgba(0,0,0,0.25) 100%),
    linear-gradient(var(--metal-dark), var(--metal-mid) 50%, var(--metal-dark));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    inset 0 -1px 0 rgba(0,0,0,0.35);
}

/* ─── Rivet ──────────────────────────────────────────────────────────────── */
.rivet {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--metal-shine) 0%, var(--metal-mid) 55%, var(--metal-dark) 100%);
  box-shadow: 0 1px 2px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
  flex-shrink: 0;
}

/* ─── Section Divider ────────────────────────────────────────────────────── */
.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 var(--section-pad-x);
  margin: 20px 0;
}

.section-divider__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
}

.section-divider__gem {
  width: 8px;
  height: 8px;
  background: var(--neon-cyan);
  transform: rotate(45deg);
  box-shadow: 0 0 8px var(--neon-cyan), 0 0 20px var(--neon-cyan-30);
  flex-shrink: 0;
}

/* ─── Act Section Header ─────────────────────────────────────────────────── */
.act-header {
  padding: var(--section-pad-y) var(--section-pad-x);
  padding-bottom: 40px;
  position: relative;
}

.act-header__watermark {
  position: absolute;
  top: 0;
  left: var(--section-pad-x);
  font-size: clamp(80px, 12vw, 160px);
  font-weight: 700;
  color: rgba(255,255,255,0.03);
  line-height: 1;
  user-select: none;
  pointer-events: none;
  font-family: var(--font-mono);
}

.act-header__eyebrow {
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--neon-cyan);
  opacity: 0.7;
  margin-bottom: 12px;
}

.act-header__title {
  font-size: clamp(28px, 4vw, 46px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  max-width: 640px;
  margin-bottom: 16px;
}

.act-header__body {
  font-size: 16px;
  line-height: 1.65;
  color: var(--text-secondary);
  max-width: 580px;
}

/* ─── Act Content Panel (beside or below ScenePlayer) ───────────────────── */
.act-content-panel {
  padding: var(--section-pad-x);
  max-width: 460px;
}

.act-content-panel__eyebrow {
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 14px;
}

.act-content-panel__title {
  font-size: clamp(22px, 2.5vw, 30px);
  font-weight: 600;
  line-height: 1.25;
  color: var(--text-primary);
  margin-bottom: 14px;
}

.act-content-panel__body {
  font-size: 15px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* ─── ScenePlayer Wrapper ────────────────────────────────────────────────── */
.scene-section {
  position: relative;
  width: 100%;
}

/* ─── GitHub CTA Section ─────────────────────────────────────────────────── */
.github-section {
  padding: var(--section-pad-y) var(--section-pad-x);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 48px;
  background: var(--bg-void);
  border-top: var(--border-dim);
}

.terminal-card {
  width: 100%;
  max-width: 640px;
  background: var(--bg-surface);
  border: var(--border-dim);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.terminal-card__bar {
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border-bottom: var(--border-dim);
  display: flex;
  align-items: center;
  gap: 7px;
}

.terminal-card__dot {
  width: 12px; height: 12px;
  border-radius: 50%;
}
.terminal-card__dot--red    { background: #ff5f57; }
.terminal-card__dot--yellow { background: #febc2e; }
.terminal-card__dot--green  { background: #28c840; }
.terminal-card__title {
  margin-left: auto;
  margin-right: auto;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.terminal-card__body {
  padding: 24px 28px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
}

.terminal-card__line {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.terminal-card__prompt {
  color: var(--neon-green);
  user-select: none;
}

.terminal-card__command {
  color: var(--text-primary);
}

.terminal-card__output {
  color: var(--text-muted);
  padding-left: 22px;
}

.terminal-card__cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--neon-cyan);
  animation: cursor-blink 1s step-end infinite;
  vertical-align: text-bottom;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.github-cta-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.github-cta-block__headline {
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 700;
  background: linear-gradient(135deg, #f0f6fc 0%, var(--neon-cyan) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.github-cta-block__body {
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 480px;
  line-height: 1.6;
}

.github-cta-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 6px;
  border: var(--border-glow);
  background: rgba(0, 245, 255, 0.08);
  color: var(--neon-cyan);
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 20px rgba(0,245,255,0.1);
}

.github-cta-button:hover {
  background: rgba(0, 245, 255, 0.14);
  box-shadow: 0 0 30px rgba(0,245,255,0.25);
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .act-header__watermark { display: none; }
  .code-block { font-size: 12px; }
}
```

---

## Phase 2: Hero Section

### 2.1 Create `apps/website/src/landing/hero/NeonSignCanvas.tsx`

Three.js metallic room background. Pure Three.js, no ScenePlayer.

```tsx
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';

export function NeonSignCanvas(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);
    scene.fog = new THREE.Fog(0x050810, 25, 90);

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 1.5, 18);
    camera.lookAt(0, 0, 0);

    // ── Materials ─────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e1220,
      metalness: 0.88,
      roughness: 0.28,
      envMapIntensity: 0.6,
    });

    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x080b14,
      metalness: 0.96,
      roughness: 0.05,
      envMapIntensity: 1.0,
    });

    const metalMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e2840,
      metalness: 0.99,
      roughness: 0.18,
    });

    // ── Geometry — Back wall ──────────────────────────────────────────────
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 35), wallMat);
    wall.position.set(0, 4, -14);
    scene.add(wall);

    // ── Geometry — Side walls ─────────────────────────────────────────────
    const sideWallGeo = new THREE.PlaneGeometry(30, 35);

    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-20, 4, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(20, 4, 0);
    scene.add(rightWall);

    // ── Geometry — Floor ─────────────────────────────────────────────────
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7;
    scene.add(floor);

    // ── Geometry — Metal frame bars around sign area ─────────────────────
    // These sit just in front of the back wall
    const barMat = metalMat;

    // Top bar
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 0.6), barMat);
    topBar.position.set(0, 7.0, -13.6);
    scene.add(topBar);

    // Bottom bar
    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 0.6), barMat);
    bottomBar.position.set(0, -2.5, -13.6);
    scene.add(bottomBar);

    // Left bar
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 10.5, 0.6), barMat);
    leftBar.position.set(-13.7, 2.25, -13.6);
    scene.add(leftBar);

    // Right bar
    const rightBar = leftBar.clone();
    rightBar.position.x = 13.7;
    scene.add(rightBar);

    // Corner bolts (spheres at bar intersections)
    const boltGeo = new THREE.SphereGeometry(0.55, 12, 8);
    const boltMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3550, metalness: 1, roughness: 0.1 });
    const boltPositions: [number, number][] = [[-13.7, 7.0], [13.7, 7.0], [-13.7, -2.5], [13.7, -2.5]];
    for (const [bx, by] of boltPositions) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(bx, by, -13.3);
      scene.add(bolt);
    }

    // Rivet rows — top and bottom bars
    const rivetGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const rivetMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4860, metalness: 0.99, roughness: 0.15 });
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const rv = new THREE.Mesh(rivetGeo, rivetMat);
      rv.position.set(i * 1.9, 7.0, -13.1);
      scene.add(rv);
      const rvb = rv.clone();
      rvb.position.y = -2.5;
      scene.add(rvb);
    }

    // ── Lighting ──────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x080d1a, 2.0);
    scene.add(ambient);

    // Warm industrial key (upper-left)
    const warmLight = new THREE.PointLight(0xff8800, 5, 60, 1.5);
    warmLight.position.set(-14, 12, 8);
    warmLight.castShadow = true;
    scene.add(warmLight);

    // Cool fill (upper-right)
    const coolLight = new THREE.PointLight(0x0055ff, 4, 55, 1.5);
    coolLight.position.set(14, 10, 6);
    scene.add(coolLight);

    // Sign backlight (subtle cyan bloom from behind sign area)
    const signLight = new THREE.PointLight(0x00ddff, 1.5, 25, 2);
    signLight.position.set(0, 2, -12);
    scene.add(signLight);

    // Ceiling strip (long narrow fill from above)
    const ceilingLight = new THREE.PointLight(0x203060, 3.5, 40, 1.2);
    ceilingLight.position.set(0, 18, 0);
    scene.add(ceilingLight);

    // ── Animation loop ────────────────────────────────────────────────────
    let frameId: number;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.008;

      // Very slow, barely-perceptible camera drift
      camera.position.x = Math.sin(t * 0.18) * 0.35;
      camera.position.y = 1.5 + Math.sin(t * 0.27) * 0.18;
      camera.lookAt(0, 0, 0);

      // Subtle warm light flicker (industrial atmosphere)
      warmLight.intensity = 5 + Math.sin(t * 7.3) * 0.15 + Math.sin(t * 13.1) * 0.08;

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
```

### 2.2 Create `apps/website/src/landing/hero/NeonSign.tsx`

```tsx
import type { JSX } from 'react';
import './hero.css';

export function NeonSign(): JSX.Element {
  return (
    <div className="neon-sign-wrapper" aria-label="BrewSite">
      {/* Diffuse outer glow layer (blurred, wide) */}
      <svg
        className="neon-svg neon-svg--glow-outer"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="none"
          stroke="#00f5ff"
          strokeWidth="10"
        >
          BrewSite
        </text>
      </svg>

      {/* Mid glow layer */}
      <svg
        className="neon-svg neon-svg--glow-mid"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="none"
          stroke="#00f5ff"
          strokeWidth="4"
        >
          BrewSite
        </text>
      </svg>

      {/* Main crisp text layer */}
      <svg
        className="neon-svg neon-svg--main"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="#00f5ff"
          stroke="#00f5ff"
          strokeWidth="1"
        >
          BrewSite
        </text>
      </svg>
    </div>
  );
}
```

### 2.3 Create `apps/website/src/landing/hero/HeroBezel.tsx`

```tsx
import type { JSX } from 'react';

export function HeroBezel(): JSX.Element {
  const rivets = Array.from({ length: 7 }, (_, i) => i);

  return (
    <div className="hero-bezel" aria-hidden="true">
      {/* Border layers */}
      <div className="hero-bezel__border" />

      {/* Corner L-brackets */}
      <div className="hero-bezel__corner hero-bezel__corner--tl" />
      <div className="hero-bezel__corner hero-bezel__corner--tr" />
      <div className="hero-bezel__corner hero-bezel__corner--bl" />
      <div className="hero-bezel__corner hero-bezel__corner--br" />

      {/* Rivet rows */}
      <div className="hero-bezel__rivets hero-bezel__rivets--top">
        {rivets.map((i) => <span key={i} className="rivet" />)}
      </div>
      <div className="hero-bezel__rivets hero-bezel__rivets--bottom">
        {rivets.map((i) => <span key={i} className="rivet" />)}
      </div>
    </div>
  );
}
```

### 2.4 Create `apps/website/src/landing/hero/ScrollIndicator.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

export function ScrollIndicator(): JSX.Element {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`scroll-indicator ${visible ? '' : 'scroll-indicator--hidden'}`} aria-hidden="true">
      <span className="scroll-indicator__label">scroll to explore</span>
      <div className="scroll-indicator__arrows">
        <span className="scroll-indicator__arrow" />
        <span className="scroll-indicator__arrow" />
      </div>
    </div>
  );
}
```

### 2.5 Create `apps/website/src/landing/hero/hero.css`

```css
/* ─── Hero Section ───────────────────────────────────────────────────────── */
.hero-section {
  position: relative;
  width: 100%;
  height: 100vh;
  min-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ─── Neon Sign ──────────────────────────────────────────────────────────── */
.neon-sign-wrapper {
  position: relative;
  width: clamp(320px, 70vw, 700px);
  height: auto;
}

.neon-svg {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: auto;
  opacity: 0;
}

/* Main text: sharp, bright */
.neon-svg--main {
  position: relative;
  animation: neon-power-on 2.6s ease-out 0.9s forwards,
             neon-pulse 3.8s ease-in-out 3.5s infinite;
  filter: drop-shadow(0 0 4px #00f5ff);
}

/* Mid glow: medium spread */
.neon-svg--glow-mid {
  animation: neon-power-on 2.6s ease-out 0.9s forwards,
             neon-pulse 3.8s ease-in-out 3.5s infinite;
  filter: blur(2px);
  opacity: 0;
}

/* Outer glow: wide diffuse halo */
.neon-svg--glow-outer {
  animation: neon-power-on 2.6s ease-out 0.9s forwards,
             neon-pulse-outer 3.8s ease-in-out 3.5s infinite;
  filter: blur(6px);
  opacity: 0;
}

@keyframes neon-power-on {
  0%   { opacity: 0; }
  6%   { opacity: 0.55; }
  10%  { opacity: 0.05; }  /* first flicker */
  16%  { opacity: 0.80; }
  20%  { opacity: 0.15; }  /* second flicker */
  26%  { opacity: 0.90; }
  30%  { opacity: 0.40; }  /* third flicker */
  38%  { opacity: 1.0; }
  100% { opacity: 1.0; }
}

@keyframes neon-pulse {
  0%, 100% { opacity: 0.92; filter: drop-shadow(0 0 4px #00f5ff); }
  50%       { opacity: 1.0;  filter: drop-shadow(0 0 8px #00f5ff) drop-shadow(0 0 20px rgba(0,245,255,0.5)); }
}

@keyframes neon-pulse-outer {
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 0.55; }
}

/* ─── Bezel ──────────────────────────────────────────────────────────────── */
.hero-bezel {
  position: absolute;
  inset: 15% 8%;
  pointer-events: none;
  z-index: 2;
}

.hero-bezel__border {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255,255,255,0.06);
  background: linear-gradient(
    140deg,
    rgba(255,255,255,0.025) 0%,
    transparent 40%,
    rgba(0,0,0,0.15) 100%
  );
  box-shadow:
    inset 0 0 0 6px rgba(0,0,0,0.35),
    inset 0 0 0 8px rgba(255,255,255,0.02),
    0 0 40px rgba(0,245,255,0.04);
}

/* Corner L-brackets */
.hero-bezel__corner {
  position: absolute;
  width: 44px;
  height: 44px;
}

.hero-bezel__corner::before,
.hero-bezel__corner::after {
  content: '';
  position: absolute;
  background: linear-gradient(135deg, #5a6880 0%, #2a3550 100%);
  box-shadow: 0 0 4px rgba(255,255,255,0.08);
}

.hero-bezel__corner::before { width: 100%; height: 3px; top: -1px; left: 0; }
.hero-bezel__corner::after  { width: 3px; height: 100%; top: 0; left: -1px; }

.hero-bezel__corner--tl { top: -1px; left: -1px; }
.hero-bezel__corner--tr { top: -1px; right: -1px; transform: scaleX(-1); }
.hero-bezel__corner--bl { bottom: -1px; left: -1px; transform: scaleY(-1); }
.hero-bezel__corner--br { bottom: -1px; right: -1px; transform: scale(-1); }

/* Rivet rows */
.hero-bezel__rivets {
  position: absolute;
  left: 0; right: 0;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  padding: 0 20px;
}

.hero-bezel__rivets--top    { top: 6px; }
.hero-bezel__rivets--bottom { bottom: 6px; }

/* ─── Hero content overlay ───────────────────────────────────────────────── */
.hero-content {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
}

.hero-tagline {
  font-size: clamp(14px, 1.6vw, 18px);
  font-family: var(--font-mono);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0;
  animation: fade-up 0.8s ease-out 3.6s forwards;
}

.hero-packages {
  display: flex;
  gap: 12px;
  opacity: 0;
  animation: fade-up 0.8s ease-out 3.9s forwards;
}

.hero-package-badge {
  padding: 5px 14px;
  border-radius: 4px;
  border: var(--border-glow);
  background: rgba(0, 245, 255, 0.07);
  font-size: 12px;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  color: var(--neon-cyan);
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── Scroll Indicator ───────────────────────────────────────────────────── */
.scroll-indicator {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 1;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 10;
  animation: fade-up 0.6s ease-out 4.2s both;
}

.scroll-indicator--hidden {
  opacity: 0;
}

.scroll-indicator__label {
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.scroll-indicator__arrows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.scroll-indicator__arrow {
  display: block;
  width: 12px;
  height: 12px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: rotate(45deg);
  animation: arrow-bounce 1.4s ease-in-out infinite;
}

.scroll-indicator__arrow:nth-child(2) {
  animation-delay: 0.2s;
  opacity: 0.5;
}

@keyframes arrow-bounce {
  0%, 100% { transform: rotate(45deg) translateY(-3px); opacity: 0.3; }
  50%       { transform: rotate(45deg) translateY(3px);  opacity: 1; }
}

/* ─── Hamburger nav button ───────────────────────────────────────────────── */
.nav-hamburger {
  position: fixed;
  top: 20px;
  right: 24px;
  z-index: 200;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  border: var(--border-dim);
  background: rgba(10, 14, 22, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  transition: background 0.2s, border-color 0.2s;
  padding: 0;
  outline: none;
}

.nav-hamburger:hover,
.nav-hamburger:focus-visible {
  background: rgba(0, 245, 255, 0.08);
  border-color: rgba(0, 245, 255, 0.25);
}

.nav-hamburger__line {
  width: 20px;
  height: 2px;
  background: var(--text-secondary);
  border-radius: 1px;
  transition: background 0.2s;
}

.nav-hamburger:hover .nav-hamburger__line {
  background: var(--neon-cyan);
}

/* ─── Nav overlay ────────────────────────────────────────────────────────── */
.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 190;
  pointer-events: none;
}

.nav-overlay--open {
  pointer-events: auto;
}

.nav-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 5, 8, 0.6);
  opacity: 0;
  transition: opacity 0.3s;
}

.nav-overlay--open .nav-overlay__backdrop {
  opacity: 1;
}

.nav-overlay__drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: min(320px, 85vw);
  height: 100%;
  background: var(--bg-surface);
  border-left: var(--border-dim);
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  padding: 72px 28px 40px;
  gap: 8px;
  box-shadow: -8px 0 40px rgba(0,0,0,0.5);
}

.nav-overlay--open .nav-overlay__drawer {
  transform: translateX(0);
}

.nav-overlay__close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  border: var(--border-dim);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 20px;
  transition: color 0.2s, background 0.2s;
  padding: 0;
}

.nav-overlay__close:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }

.nav-link {
  display: block;
  padding: 12px 4px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-bottom: var(--border-dim);
  transition: color 0.2s;
  cursor: pointer;
  background: transparent;
  border-top: none;
  border-left: none;
  border-right: none;
  text-align: left;
  font-family: var(--font-sans);
  width: 100%;
}

.nav-link:hover {
  color: var(--neon-cyan);
}

.nav-link__num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 8px;
}
```

### 2.6 Create `apps/website/src/landing/hero/HeroSection.tsx`

```tsx
import type { JSX } from 'react';
import { NeonSignCanvas } from './NeonSignCanvas';
import { NeonSign } from './NeonSign';
import { HeroBezel } from './HeroBezel';
import { ScrollIndicator } from './ScrollIndicator';

export function HeroSection(): JSX.Element {
  return (
    <section className="hero-section" id="hero">
      {/* Three.js metallic room — full bleed background */}
      <NeonSignCanvas />

      {/* Bezel frame overlay */}
      <HeroBezel />

      {/* Main content */}
      <div className="hero-content">
        <NeonSign />

        <p className="hero-tagline">Author in JSX. Ship to any surface.</p>

        <div className="hero-packages">
          <span className="hero-package-badge">@brewsite/core</span>
          <span className="hero-package-badge">@brewsite/diagram</span>
        </div>
      </div>

      {/* Scroll prompt */}
      <ScrollIndicator />
    </section>
  );
}
```

---

## Phase 3: Navigation

### 3.1 Create `apps/website/src/landing/nav/NavMenu.tsx`

```tsx
import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';

const NAV_LINKS = [
  { num: '00', label: 'Hero',         anchor: '#hero' },
  { num: '01', label: 'The Core',     anchor: '#act-core' },
  { num: '02', label: 'Libraries',    anchor: '#act-libraries' },
  { num: '03', label: 'Models',       anchor: '#act-models' },
  { num: '04', label: 'The Meeting',  anchor: '#act-meeting' },
  { num: '05', label: 'Diagrams',     anchor: '#act-diagrams' },
  { num: '06', label: 'Architecture', anchor: '#act-arch' },
  { num: '07', label: 'Full Stack',   anchor: '#act-fullstack' },
  { num: '08', label: 'GitHub',       anchor: '#act-github' },
] as const;

export function NavMenu(): JSX.Element {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const handleNavClick = useCallback((anchor: string) => {
    close();
    const el = document.querySelector(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, [close]);

  return (
    <>
      {/* Hamburger button */}
      <button
        className="nav-hamburger"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="nav-hamburger__line" />
        <span className="nav-hamburger__line" />
        <span className="nav-hamburger__line" />
      </button>

      {/* Overlay + drawer */}
      <div className={`nav-overlay ${open ? 'nav-overlay--open' : ''}`}>
        {/* Backdrop */}
        <div className="nav-overlay__backdrop" onClick={close} />

        {/* Drawer */}
        <nav className="nav-overlay__drawer" aria-label="Site navigation">
          <button className="nav-overlay__close" onClick={close} aria-label="Close menu">×</button>

          {NAV_LINKS.map(({ num, label, anchor }) => (
            <button
              key={anchor}
              className="nav-link"
              onClick={() => handleNavClick(anchor)}
            >
              <span className="nav-link__num">{num}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
```

---

## Phase 4: Scene Assets and Widget Setup

### 4.1 Create `apps/website/src/scenes/sceneAssets.ts`

```typescript
// Shared asset URL constants for website scenes.
// All paths are relative to /public/.

export const backgrounds = {
  dark:      '/assets/backgrounds/bg_dark_metal.jpg',
  midnight:  '/assets/backgrounds/bg_midnight.jpg',
  // Note: if these specific backgrounds don't exist, use color-only backgrounds
  // by omitting the imageUrl prop on <Background> and using `color` instead.
} as const;

export const sceneLighting = {
  industrial: {
    ambient: 0.3,
    directional: 0.7,
    direction: [5, 15, 20] as [number, number, number],
  },
  soft: {
    ambient: 0.5,
    directional: 0.5,
    direction: [0, 20, 20] as [number, number, number],
  },
} as const;
```

> **Note to implementing engineer:** The website uses solid background colors (`<Background enabled color="#04080f" />`) rather than image URLs for Acts 1–7. Only the hero and GitHub sections have non-3D backgrounds. Do not add image files unless specifically needed.

---

## Phase 5: Scene DSL Files

### 5.1 Acts 1 & 2 — Core + Libraries (4 scenes, one ScenePlayer)

**File:** `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Ambient, Directional, Hud, HudItem } from '@brewsite/core';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene01CoreIntro: JSX.Element = (
  <Scene id="website-core-01">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />
    <Background enabled color="#04080f" />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.15} color="#000a20" />
      <Directional intensity={0.5} color="#0066ff" position={[3, 8, 5]} />
      <Directional intensity={0.25} color="#ff5500" position={[-5, 4, 3]} />
    </Lighting>
    <Hud>
      <HudItem id="core-intro-hud">
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 620, padding: '0 24px' }}>
            <MidFade duration={1400}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(0,245,255,0.6)',
                marginBottom: 18,
              }}>
                @brewsite/core
              </div>
              <h2 style={{
                fontSize: 'clamp(36px, 5vw, 58px)',
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: '0 0 20px',
              }}>
                Scenes as JSX.<br />Rendered like film.
              </h2>
            </MidFade>
            <SlideUp duration={1000} delay={200}>
              <p style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: 'rgba(240,246,252,0.6)',
                maxWidth: 480,
                margin: '0 auto',
              }}>
                Declare 3D scene states. Let the compiler handle transitions.
                No animation loops. No frame math. Just describe what you want.
              </p>
            </SlideUp>
          </div>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**File:** `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Ambient, Directional, Hud, HudItem } from '@brewsite/core';
import { Fade, SlideUp } from '@brewsite/core/hud/animejs';

const tags = ['Declarative', 'Scroll-Driven', 'SSR-Safe', 'TypeScript-First', 'O(1) Sampling'];

export const scene02CoreBaked: JSX.Element = (
  <Scene id="website-core-02">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0.5, 0]} fov={65} />
    <Background enabled color="#050a14" />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.1} color="#000510" />
      <Directional intensity={0.55} color="#0088ff" position={[4, 10, 6]} />
    </Lighting>
    <Hud>
      <HudItem id="core-baked-hud">
        <div style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 680,
          textAlign: 'center',
        }}>
          <Fade duration={900}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(240,246,252,0.4)',
              marginBottom: 14,
            }}>
              Pre-baked. Zero runtime cost.
            </div>
          </Fade>
          <SlideUp duration={1000} delay={100}>
            <p style={{
              fontSize: 'clamp(20px, 2.5vw, 28px)',
              fontWeight: 600,
              color: '#f0f6fc',
              lineHeight: 1.3,
              marginBottom: 22,
            }}>
              The compiler bakes every transition frame.<br />
              Playback is O(1). Always.
            </p>
          </SlideUp>
          <SlideUp duration={900} delay={220}>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  padding: '5px 14px',
                  borderRadius: 4,
                  border: '1px solid rgba(0,245,255,0.28)',
                  background: 'rgba(0,245,255,0.07)',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.07em',
                  color: '#00f5ff',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </SlideUp>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**File:** `apps/website/src/scenes/act1_act2/scene_03_hud_is_react.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Ambient, Directional, Hud, HudItem } from '@brewsite/core';
import { ScrollOn, SlideUp } from '@brewsite/core/hud/animejs';

export const scene03HudIsReact: JSX.Element = (
  <Scene id="website-libraries-01">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />
    <Background enabled color="#060810" />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.1} color="#000820" />
      <Directional intensity={0.4} color="#00aaff" position={[5, 8, 5]} />
      <Directional intensity={0.3} color="#aa00ff" position={[-5, 6, 3]} />
    </Lighting>
    <Hud>
      <HudItem id="hud-react-hud">
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
            <ScrollOn duration={1200}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(170,0,255,0.7)',
                marginBottom: 16,
              }}>
                HUD is just React
              </div>
              <h2 style={{
                fontSize: 'clamp(32px, 4.5vw, 50px)',
                fontWeight: 700,
                lineHeight: 1.15,
                color: '#f0f6fc',
                marginBottom: 18,
              }}>
                Any library.<br />Any component.<br />Any animation system.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(240,246,252,0.6)', lineHeight: 1.6 }}>
                HudItems are React subtrees. Use anime.js, Framer Motion, Recharts,
                live data feeds — if it renders in React, it renders in the HUD.
              </p>
            </ScrollOn>
          </div>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**File:** `apps/website/src/scenes/act1_act2/scene_04_transitions.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Ambient, Hud, HudItem } from '@brewsite/core';
import { SlideUp, ScrollOff } from '@brewsite/core/hud/animejs';

const transitionNames = ['Fade', 'MidFade', 'SlideUp', 'SlideDown', 'ScrollOn', 'ScrollOff'];

export const scene04Transitions: JSX.Element = (
  <Scene id="website-libraries-02">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />
    <Background enabled color="#04060e" />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.08} color="#000510" />
    </Lighting>
    <Hud>
      <HudItem id="transitions-hud">
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}>
          <ScrollOff duration={1200}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(0,245,255,0.6)',
            }}>
              @brewsite/core/hud/animejs
            </div>
          </ScrollOff>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 480 }}>
            {transitionNames.map((name, i) => (
              <SlideUp key={name} duration={700} delay={i * 80}>
                <div style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,245,255,0.22)',
                  background: 'rgba(0,245,255,0.06)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  color: '#00f5ff',
                  letterSpacing: '0.04em',
                }}>
                  {name}
                </div>
              </SlideUp>
            ))}
          </div>
          <SlideUp duration={900} delay={600}>
            <p style={{ fontSize: 14, color: 'rgba(240,246,252,0.5)', textAlign: 'center', maxWidth: 360 }}>
              Scroll-driven. Anime.js under the hood. Import and use.
            </p>
          </SlideUp>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

### 5.2 Act 3 — Models (2 scenes, separate ScenePlayer)

**File:** `apps/website/src/scenes/act3/scene_01_model_wide.tsx`

```tsx
import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror, ModelRouter, Hud, HudItem,
} from '@brewsite/core';
import { MidFade } from '@brewsite/core/hud/animejs';

export const scene01ModelWide: JSX.Element = (
  <Scene id="website-model-01">
    <Camera mode="world" position={[0, 8, 38]} target={[0, 5, 0]} fov={55} />
    <Background enabled color="#080c14" />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0a1428"
        mirrorOpacity={0.38}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#e0e8ff" />
      <Directional intensity={0.9} color="#ffffff" position={[5, 20, 22]} />
      <Directional intensity={0.4} color="#0066ff" position={[-8, 6, 10]} />
    </Lighting>
    <ModelRouter
      type="Worker"
      id="worker-wide"
      position={[0, 0, 0]}
      rotation={[0, 0.2, 0]}
    />
    <Hud>
      <HudItem id="model-wide-hud">
        <div style={{
          position: 'absolute',
          top: '8%',
          left: '5%',
        }}>
          <MidFade duration={1200}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(240,246,252,0.4)',
              marginBottom: 10,
            }}>
              @brewsite/core · Model Element
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc' }}>
              Drop a GLTF.<br />Get a scene.
            </div>
          </MidFade>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**File:** `apps/website/src/scenes/act3/scene_02_model_close.tsx`

```tsx
import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror, ModelRouter, Hud, HudItem,
} from '@brewsite/core';
import { Fade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene02ModelClose: JSX.Element = (
  <Scene id="website-model-02">
    <Camera mode="world" position={[3, 16, 20]} target={[0, 14, 0]} fov={45} />
    <Background enabled color="#060a10" />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0a1428"
        mirrorOpacity={0.3}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.3} color="#dce8ff" />
      <Directional intensity={1.1} color="#ffffff" position={[3, 22, 18]} />
      <Directional intensity={0.55} color="#ff6600" position={[8, 5, 6]} />
      <Directional intensity={0.3} color="#0033ff" position={[-6, 8, 8]} />
    </Lighting>
    <ModelRouter
      type="Worker"
      id="worker-close"
      position={[0, 0, 0]}
      rotation={[0, 0.15, 0]}
    />
    <Hud>
      <HudItem id="model-close-hud">
        <div style={{
          position: 'absolute',
          top: '8%',
          right: '5%',
          textAlign: 'right',
          maxWidth: 320,
        }}>
          <Fade duration={900}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(255,102,0,0.7)',
              marginBottom: 10,
            }}>
              GLTF · PBR Materials
            </div>
          </Fade>
          <SlideUp duration={1000} delay={80}>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc', lineHeight: 1.3, marginBottom: 10 }}>
              Physically Based.<br />Floor-to-ceiling.
            </div>
          </SlideUp>
          <SlideUp duration={900} delay={200}>
            <div style={{ fontSize: 14, color: 'rgba(240,246,252,0.55)', lineHeight: 1.6 }}>
              Metalness, roughness, normals — the renderer handles it.
              You handle the story.
            </div>
          </SlideUp>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

### 5.3 Act 4 — The Meeting (1 scene, separate ScenePlayer)

**File:** `apps/website/src/scenes/act4/scene_01_meeting.tsx`

This scene is a near-direct port from `apps/examples/meeting/scenes/scene02_arrival.tsx`. Copy the full file to this location and change the scene id to `"website-meeting-01"`. Adjust the HUD content:

```tsx
// HUD content changes only — rest identical to examples/meeting/scenes/scene02_arrival.tsx
// Change the HudItem content to:
<HudItem id="website-meeting-hud">
  <div style={{
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '28%',
    padding: '20px 40px',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, rgba(4,8,18,0.2) 0%, rgba(4,8,18,0.95) 100%)',
    display: 'flex',
    alignItems: 'center',
  }}>
    <div style={{ maxWidth: 560 }}>
      <MidFade duration={1400}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.6)',
          marginBottom: 10,
        }}>
          Procedural Composition
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#f0f6fc', marginBottom: 10 }}>
          30 characters. 50 lines of JSX.
        </div>
        <div style={{ fontSize: 16, color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
          Random placement, collision detection, animation assignment — all at
          author time. Runtime is just playback.
        </div>
      </MidFade>
    </div>
  </div>
</HudItem>
```

### 5.4 Acts 5 & 6 — Diagrams (3 scenes, one ScenePlayer)

**File:** `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Background, Lighting, Ambient, Directional, Hud, HudItem } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, ManualLayout } from '@brewsite/diagram';
// IMPORTANT: Verify export name — may be neonCyberTheme or neonCyber
import { neonCyberTheme } from '@brewsite/diagram';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene01SimpleDiagram: JSX.Element = (
  <Scene id="website-diagram-simple">
    <Camera mode="world" position={[0, 8, 40]} target={[0, 0, 0]} fov={55} />
    <Background enabled color="#04060e" />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#00aaff" position={[-10, 10, 10]} />
    </Lighting>
    <DiagramCanvas
      id="simple-tech-stack"
      rotation={[-Math.PI / 12, 0, 0]}
      scale={1.3}
      theme={neonCyberTheme}
    >
      <Diagram id="tech-stack" pivot="center">
        <ManualLayout />
        <DiagramNode id="frontend" label="React App"    icon="ui:browser"          position={[0, 4, 0]} />
        <DiagramNode id="api"      label="API Gateway"  icon="aws:api-gateway"     position={[0, 0, 0]} />
        <DiagramNode id="db"       label="PostgreSQL"   icon="aws:rds"             position={[-3, -4, 0]} />
        <DiagramNode id="cache"    label="Redis"        icon="aws:elasticache"     position={[3, -4, 0]} />

        <DiagramEdge from="frontend" to="api"   label="REST"   flow="forward" />
        <DiagramEdge from="api"      to="db"    label="SQL"    flow="forward" />
        <DiagramEdge from="api"      to="cache" label="Cache"  flow="forward" style="dashed" />
      </Diagram>
    </DiagramCanvas>
    <Hud>
      <HudItem id="simple-diagram-hud">
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', maxWidth: 360 }}>
          <MidFade duration={1300}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(0,245,255,0.6)',
              marginBottom: 10,
            }}>
              @brewsite/diagram
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc', marginBottom: 12 }}>
              From whiteboard<br />to 3D in JSX.
            </div>
          </MidFade>
          <SlideUp duration={900} delay={150}>
            <div style={{ fontSize: 14, color: 'rgba(240,246,252,0.6)', lineHeight: 1.65 }}>
              Themes, icons, routed edges, groups. No Figma required.
            </div>
          </SlideUp>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**Files:** `scene_02_arch_overview.tsx` and `scene_03_arch_detail.tsx`

These are near-direct ports from:
- `apps/examples/diagram/scenes/scene_arch_overview.tsx` → change scene id to `"website-arch-overview"`
- `apps/examples/diagram/scenes/scene_arch_ecs_detail.tsx` → change scene id to `"website-arch-detail"`

Add HUD content to `scene_02_arch_overview.tsx`:
```tsx
<Hud>
  <HudItem id="arch-overview-hud">
    <div style={{ position: 'absolute', top: '6%', right: '5%', textAlign: 'right', maxWidth: 300 }}>
      <MidFade duration={1200}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.4)', marginBottom: 8 }}>
          Production Architecture
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#f0f6fc' }}>
          16 nodes · 4 tiers · 8 edges
        </div>
      </MidFade>
    </div>
    <div style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 360 }}>
      <SlideUp duration={1000} delay={100}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc' }}>Architecture diagrams.<br />Presentation-ready.</div>
      </SlideUp>
    </div>
  </HudItem>
</Hud>
```

### 5.5 Act 7 — Full Stack (2 scenes, separate ScenePlayer)

**File:** `apps/website/src/scenes/act7/scene_01_foundation.tsx`

```tsx
import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror, Hud, HudItem,
} from '@brewsite/core';
import { MidFade } from '@brewsite/core/hud/animejs';

export const scene01Foundation: JSX.Element = (
  <Scene id="website-full-01">
    <Camera mode="world" position={[0, 12, 55]} target={[0, 4, 0]} fov={58} />
    <Background enabled color="#040608" />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror mirrorColor="#060a18" mirrorOpacity={0.25} mirrorResolution={512} mirrorClipBias={0.003} />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.25} color="#e0eaff" />
      <Directional intensity={0.7} color="#ffffff" position={[0, 25, 30]} />
      <Directional intensity={0.3} color="#0055ff" position={[-15, 10, 10]} />
      <Directional intensity={0.25} color="#ff3300" position={[15, 5, 10]} />
    </Lighting>
    <Hud>
      <HudItem id="full-foundation-hud">
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MidFade duration={1500}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: 'rgba(0,245,255,0.5)',
                marginBottom: 16,
              }}>
                BrewSite
              </div>
              <h2 style={{
                fontSize: 'clamp(36px, 5.5vw, 62px)',
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: '-0.025em',
                background: 'linear-gradient(135deg, #f0f6fc 0%, #00f5ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                One framework.<br />Every medium.
              </h2>
            </div>
          </MidFade>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

**File:** `apps/website/src/scenes/act7/scene_02_combined.tsx`

```tsx
import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror, ModelRouter, Hud, HudItem,
} from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, ManualLayout, darkGlassTheme } from '@brewsite/diagram';
import { SlideUp } from '@brewsite/core/hud/animejs';

export const scene02Combined: JSX.Element = (
  <Scene id="website-full-02">
    <Camera mode="world" position={[-8, 14, 55]} target={[5, 3, -5]} fov={60} />
    <Background enabled color="#030508" />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror mirrorColor="#050810" mirrorOpacity={0.22} mirrorResolution={512} mirrorClipBias={0.003} />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#e0eaff" />
      <Directional intensity={0.8} color="#ffffff" position={[5, 25, 25]} />
      <Directional intensity={0.35} color="#0055ff" position={[-12, 10, 10]} />
    </Lighting>

    {/* Presenter model — left */}
    <ModelRouter
      type="businessM0079"
      id="presenter"
      position={[-18, 0, 5]}
      rotation={[0, Math.PI / 5, 0]}
    />

    {/* Architecture diagram — right, slightly elevated and angled */}
    <DiagramCanvas
      id="full-diagram"
      rotation={[-Math.PI / 10, -Math.PI / 8, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="full-arch" pivot="center">
        <ManualLayout />
        <DiagramNode id="ui"  label="Web App"    icon="ui:browser"       position={[0, 3, 0]} />
        <DiagramNode id="api" label="API Server"  icon="aws:api-gateway"  position={[0, 0, 0]} />
        <DiagramNode id="db"  label="Database"   icon="aws:rds"           position={[-2.5, -3, 0]} />
        <DiagramNode id="cdn" label="CDN"        icon="aws:cloudfront"    position={[2.5, -3, 0]} />
        <DiagramEdge from="ui"  to="api" flow="forward" />
        <DiagramEdge from="api" to="db"  flow="forward" />
        <DiagramEdge from="api" to="cdn" flow="forward" style="dashed" />
      </Diagram>
    </DiagramCanvas>

    <Hud>
      <HudItem id="full-combined-hud">
        <div style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 380 }}>
          <SlideUp duration={1100}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(0,245,255,0.55)',
              marginBottom: 12,
            }}>
              Models + Diagrams + HUD + React
            </div>
          </SlideUp>
          <SlideUp duration={1100} delay={120}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#f0f6fc', lineHeight: 1.25 }}>
              Web apps. Decks.<br />Pitches. Marketing sites.
            </div>
          </SlideUp>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
```

---

## Phase 6: Act Components (UI wrappers for ScenePlayers)

### 6.1 Create `apps/website/src/landing/acts/Act1Act2_Core.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../../widgetSetup';
import { scene01CoreIntro } from '../../scenes/act1_act2/scene_01_core_intro';
import { scene02CoreBaked } from '../../scenes/act1_act2/scene_02_core_baked';
import { scene03HudIsReact } from '../../scenes/act1_act2/scene_03_hud_is_react';
import { scene04Transitions } from '../../scenes/act1_act2/scene_04_transitions';

const CODE_SAMPLE = `<Scene id="intro">
  <Background enabled color="#04080f" />
  <Camera mode="world"
    position={[0, 1, 8]}
    target={[0, 0, 0]}
    fov={70}
  />
  <Hud>
    <HudItem id="intro-hud">
      <MidFade duration={1200}>
        <h2>Scenes as JSX.</h2>
      </MidFade>
    </HudItem>
  </Hud>
</Scene>`;

export function Act1Act2_Core(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) console.error('[Act1+2]', error);
  }, [error]);

  return (
    <>
      {/* Section header */}
      <div className="act-header" id="act-core">
        <div className="act-header__watermark" aria-hidden="true">01</div>
        <div className="act-header__eyebrow">01 · The Core</div>
        <h2 className="act-header__title">Declare scenes in JSX.<br />The compiler does the rest.</h2>
        <p className="act-header__body">
          Author 3D scene snapshots as pure JSX. The BrewSite compiler infers transitions,
          bakes every frame, and produces an O(1)-sampling SceneTrack. No frame callbacks.
          No animation math. No Three.js in your authoring layer.
        </p>
        <div className="feature-tags" style={{ marginTop: 20 }}>
          {['Declarative', 'Pre-baked', 'Scroll-Driven', 'SSR-Safe', 'TypeScript-First'].map((t) => (
            <span key={t} className="feature-tag">{t}</span>
          ))}
        </div>
      </div>

      {/* ScenePlayer — 4 scenes covering Acts 1 and 2 */}
      <div className="scene-section" id="act-libraries">
        <ScenePlayer
          manifestUrl="/scene-manifest.json"
          widgetSetup={createWidgetSetup}
          quality="balanced"
          pixelsPerScene={1400}
          onError={setError}
          placeholder={
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8b949e' }}>
              Loading…
            </div>
          }
        >
          {scene01CoreIntro}
          {scene02CoreBaked}
          {scene03HudIsReact}
          {scene04Transitions}
        </ScenePlayer>
      </div>

      {/* Code sample section */}
      <div style={{ padding: '60px var(--section-pad-x)', maxWidth: 720 }}>
        <div className="act-header__eyebrow" style={{ marginBottom: 16 }}>The DSL that drives the scene above</div>
        <div className="code-block">
          <div className="code-block__header">
            <span className="code-block__dot code-block__dot--red" />
            <span className="code-block__dot code-block__dot--yellow" />
            <span className="code-block__dot code-block__dot--green" />
            <span style={{ marginLeft: 8 }}>scene_01_intro.tsx</span>
          </div>
          <div className="code-block__body">
            <code style={{ color: '#e0e8ff', whiteSpace: 'pre', display: 'block' }}>
              {CODE_SAMPLE}
            </code>
          </div>
        </div>
      </div>
    </>
  );
}
```

### 6.2 Create `apps/website/src/landing/acts/Act3_Models.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../../widgetSetup';
import { scene01ModelWide } from '../../scenes/act3/scene_01_model_wide';
import { scene02ModelClose } from '../../scenes/act3/scene_02_model_close';

export function Act3_Models(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (error) console.error('[Act3]', error); }, [error]);

  return (
    <>
      <div className="section-divider"><div className="section-divider__line" /><div className="section-divider__gem" /><div className="section-divider__line" /></div>

      <div className="act-header" id="act-models">
        <div className="act-header__watermark" aria-hidden="true">03</div>
        <div className="act-header__eyebrow">03 · Models</div>
        <h2 className="act-header__title">Drop a GLTF.<br />Get a production scene.</h2>
        <p className="act-header__body">
          Floor mirrors, PBR lighting, camera choreography — all declared in JSX.
          The renderer handles metalness, roughness, normals, and reflections.
          You handle the story.
        </p>
        <div className="feature-tags" style={{ marginTop: 20 }}>
          {['GLTF', 'PBR Materials', 'Floor Mirror', 'Camera Modes', 'Auto-Foot-Offset'].map((t) => (
            <span key={t} className="feature-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="scene-section">
        <ScenePlayer
          manifestUrl="/scene-manifest.json"
          widgetSetup={createWidgetSetup}
          quality="balanced"
          pixelsPerScene={1400}
          onError={setError}
          placeholder={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8b949e' }}>Loading…</div>}
        >
          {scene01ModelWide}
          {scene02ModelClose}
        </ScenePlayer>
      </div>
    </>
  );
}
```

### 6.3 Create `apps/website/src/landing/acts/Act4_Meeting.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../../widgetSetup';
// Import adapted meeting scene
import { scene01Meeting } from '../../scenes/act4/scene_01_meeting';

export function Act4_Meeting(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (error) console.error('[Act4]', error); }, [error]);

  return (
    <>
      <div className="section-divider"><div className="section-divider__line" /><div className="section-divider__gem" /><div className="section-divider__line" /></div>

      <div className="act-header" id="act-meeting">
        <div className="act-header__watermark" aria-hidden="true">04</div>
        <div className="act-header__eyebrow">04 · Procedural Composition</div>
        <h2 className="act-header__title">30 characters.<br />50 lines of JSX.</h2>
        <p className="act-header__body">
          Procedural generation at author time, pure playback at runtime.
          Collision-aware placement, randomized animation clips, varied character pools —
          all expressed declaratively, compiled to a flat frame array.
        </p>
        <div className="feature-tags" style={{ marginTop: 20 }}>
          {['Procedural', 'Animation Clips', 'ModelRouter', 'Crowd Simulation', 'Zero Runtime Overhead'].map((t) => (
            <span key={t} className="feature-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="scene-section">
        <ScenePlayer
          manifestUrl="/scene-manifest.json"
          widgetSetup={createWidgetSetup}
          quality="performance"
          pixelsPerScene={1800}
          onError={setError}
          placeholder={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8b949e' }}>Loading crowd…</div>}
        >
          {scene01Meeting}
        </ScenePlayer>
      </div>
    </>
  );
}
```

### 6.4 Create `apps/website/src/landing/acts/Act5Act6_Diagrams.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../../widgetSetup';
import { scene01SimpleDiagram } from '../../scenes/act5_act6/scene_01_simple_diagram';
import { scene02ArchOverview } from '../../scenes/act5_act6/scene_02_arch_overview';
import { scene03ArchDetail } from '../../scenes/act5_act6/scene_03_arch_detail';

export function Act5Act6_Diagrams(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (error) console.error('[Act5+6]', error); }, [error]);

  return (
    <>
      <div className="section-divider"><div className="section-divider__line" /><div className="section-divider__gem" /><div className="section-divider__line" /></div>

      <div className="act-header" id="act-diagrams">
        <div className="act-header__watermark" aria-hidden="true">05</div>
        <div className="act-header__eyebrow">05–06 · Immersive Diagrams</div>
        <h2 className="act-header__title">3D architecture diagrams.<br />In JSX. Presentation-ready.</h2>
        <p className="act-header__body">
          From simple tech stacks to enterprise AWS architectures, <code>@brewsite/diagram</code> renders
          physically-based 3D diagrams with routed edges, group boundaries, icon libraries,
          and multiple themes. No diagramming tool required.
        </p>
        <div className="feature-tags" style={{ marginTop: 20 }}>
          {['DiagramNode', 'DiagramEdge', 'DiagramGroup', 'AWS/GCP/Azure Icons', 'Edge Routing', 'Themes'].map((t) => (
            <span key={t} className="feature-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="scene-section" id="act-arch">
        <ScenePlayer
          manifestUrl="/scene-manifest.json"
          widgetSetup={createWidgetSetup}
          quality="balanced"
          pixelsPerScene={1400}
          onError={setError}
          placeholder={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8b949e' }}>Loading diagram…</div>}
        >
          {scene01SimpleDiagram}
          {scene02ArchOverview}
          {scene03ArchDetail}
        </ScenePlayer>
      </div>
    </>
  );
}
```

### 6.5 Create `apps/website/src/landing/acts/Act7_FullStack.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../../widgetSetup';
import { scene01Foundation } from '../../scenes/act7/scene_01_foundation';
import { scene02Combined } from '../../scenes/act7/scene_02_combined';

export function Act7_FullStack(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (error) console.error('[Act7]', error); }, [error]);

  return (
    <>
      <div className="section-divider"><div className="section-divider__line" /><div className="section-divider__gem" /><div className="section-divider__line" /></div>

      <div className="act-header" id="act-fullstack">
        <div className="act-header__watermark" aria-hidden="true">07</div>
        <div className="act-header__eyebrow">07 · The Full Stack</div>
        <h2 className="act-header__title">Models. Diagrams. HUD. React.<br />All in one scene.</h2>
        <p className="act-header__body">
          This is what a real BrewSite presentation looks like: 3D characters, floating
          architecture diagrams, animated HUD overlays, and scroll-driven cinematography —
          authored declaratively, compiled to a deterministic frame track.
        </p>
        <div className="feature-tags" style={{ marginTop: 20 }}>
          {['Models + Diagrams', 'HUD Overlays', 'React Components', 'Camera Choreography', 'Presentations'].map((t) => (
            <span key={t} className="feature-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="scene-section">
        <ScenePlayer
          manifestUrl="/scene-manifest.json"
          widgetSetup={createWidgetSetup}
          quality="balanced"
          pixelsPerScene={1600}
          onError={setError}
          placeholder={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8b949e' }}>Loading…</div>}
        >
          {scene01Foundation}
          {scene02Combined}
        </ScenePlayer>
      </div>
    </>
  );
}
```

### 6.6 Create `apps/website/src/landing/acts/Act8_GitHub.tsx`

```tsx
import type { JSX } from 'react';

// Update this URL before launch:
const GITHUB_URL = 'https://github.com/brewsite/brewsite';

export function Act8_GitHub(): JSX.Element {
  return (
    <>
      <div className="section-divider"><div className="section-divider__line" /><div className="section-divider__gem" /><div className="section-divider__line" /></div>

      <section className="github-section" id="act-github">
        {/* Terminal card */}
        <div className="terminal-card">
          <div className="terminal-card__bar">
            <span className="terminal-card__dot terminal-card__dot--red" />
            <span className="terminal-card__dot terminal-card__dot--yellow" />
            <span className="terminal-card__dot terminal-card__dot--green" />
            <span className="terminal-card__title">terminal</span>
          </div>
          <div className="terminal-card__body">
            <div className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__command"> npm install @brewsite/core @brewsite/diagram</span>
            </div>
            <div className="terminal-card__output">added 2 packages in 0.9s</div>
            <div style={{ marginTop: 10 }} className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__cursor" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* CTA block */}
        <div className="github-cta-block">
          <h2 className="github-cta-block__headline">Open Source. Production Ready.</h2>
          <p className="github-cta-block__body">
            Built for TypeScript. Designed for developers.
            Author scenes in JSX, ship immersive 3D experiences — for the web,
            for presentations, for everywhere.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="github-cta-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.929.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Star on GitHub →
          </a>
        </div>
      </section>
    </>
  );
}
```

---

## Phase 7: Landing Page Assembly

### 7.1 Create `apps/website/src/landing/LandingPage.tsx`

```tsx
import type { JSX } from 'react';
import { HeroSection } from './hero/HeroSection';
import { NavMenu } from './nav/NavMenu';
import { Act1Act2_Core } from './acts/Act1Act2_Core';
import { Act3_Models } from './acts/Act3_Models';
import { Act4_Meeting } from './acts/Act4_Meeting';
import { Act5Act6_Diagrams } from './acts/Act5Act6_Diagrams';
import { Act7_FullStack } from './acts/Act7_FullStack';
import { Act8_GitHub } from './acts/Act8_GitHub';

export default function LandingPage(): JSX.Element {
  return (
    <div className="landing-page">
      {/* Fixed navigation — always visible */}
      <NavMenu />

      {/* Act 0: Hero */}
      <HeroSection />

      {/* Acts 1 & 2: Core + Libraries */}
      <Act1Act2_Core />

      {/* Act 3: Models */}
      <Act3_Models />

      {/* Act 4: The Meeting */}
      <Act4_Meeting />

      {/* Acts 5 & 6: Diagrams */}
      <Act5Act6_Diagrams />

      {/* Act 7: Full Stack */}
      <Act7_FullStack />

      {/* Act 8: GitHub CTA */}
      <Act8_GitHub />
    </div>
  );
}
```

---

## Phase 8: Directory and File Summary

All files to create (in order of dependency):

```
apps/website/vite.config.ts                                   ← REPLACE
apps/website/package.json                                      ← REPLACE
apps/website/src/index.html                                    ← REPLACE
apps/website/src/main.tsx                                      ← REPLACE
apps/website/src/App.tsx                                       ← REPLACE
apps/website/src/style.css                                     ← REPLACE
apps/website/src/widgetSetup.ts                                ← NEW
apps/website/public/assets/                                    ← POPULATE (symlink from examples)

apps/website/src/landing/LandingPage.tsx                       ← NEW
apps/website/src/landing/hero/NeonSignCanvas.tsx               ← NEW
apps/website/src/landing/hero/NeonSign.tsx                     ← NEW
apps/website/src/landing/hero/HeroBezel.tsx                    ← NEW
apps/website/src/landing/hero/ScrollIndicator.tsx              ← NEW
apps/website/src/landing/hero/HeroSection.tsx                  ← NEW
apps/website/src/landing/hero/hero.css                         ← NEW
apps/website/src/landing/nav/NavMenu.tsx                       ← NEW
apps/website/src/landing/acts/Act1Act2_Core.tsx                ← NEW
apps/website/src/landing/acts/Act3_Models.tsx                  ← NEW
apps/website/src/landing/acts/Act4_Meeting.tsx                 ← NEW
apps/website/src/landing/acts/Act5Act6_Diagrams.tsx            ← NEW
apps/website/src/landing/acts/Act7_FullStack.tsx               ← NEW
apps/website/src/landing/acts/Act8_GitHub.tsx                  ← NEW

apps/website/src/scenes/sceneAssets.ts                        ← NEW
apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx     ← NEW
apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx     ← NEW
apps/website/src/scenes/act1_act2/scene_03_hud_is_react.tsx   ← NEW
apps/website/src/scenes/act1_act2/scene_04_transitions.tsx    ← NEW
apps/website/src/scenes/act3/scene_01_model_wide.tsx          ← NEW
apps/website/src/scenes/act3/scene_02_model_close.tsx         ← NEW
apps/website/src/scenes/act4/scene_01_meeting.tsx             ← ADAPT from examples/meeting
apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx ← NEW
apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx  ← ADAPT from examples/diagram
apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx    ← ADAPT from examples/diagram
apps/website/src/scenes/act7/scene_01_foundation.tsx          ← NEW
apps/website/src/scenes/act7/scene_02_combined.tsx            ← NEW
```

---

## Known Issues & Notes for Implementing Engineer

### Theme Export Names
The neon cyber theme is referenced as `neonCyberTheme` in this plan. Verify the actual export name in `packages/diagram/src/index.ts` before implementing. Use `grep "neon" packages/diagram/src/index.ts` to confirm.

### DiagramCanvas position prop
`DiagramCanvas` may not accept a `position` prop. In `scene_02_combined.tsx`, the diagram positioning is done via `rotation` and `scale`. If a 3D offset is needed, wrap `<DiagramCanvas>` in a container group or use the `<Scene>` coordinate space differently. Verify `packages/diagram/src/elements/diagram/canvas/` for supported props.

### Worker model idle animation
The Worker model has no animation clips — it is a static mesh that renders in a T-pose unless animated. In Acts 3 and 7, this is intentional: the static model showcases materials and lighting. If movement is desired, use `businessM0079` or similar with the chat/discuss animation clips.

### Act 4 meeting scene
The meeting crowd is heavy (30 characters × multiple models). Use `quality="performance"` (30 framesPerTick) to keep the initial compile fast. Consider `pixelsPerScene={1800}` to give enough scroll depth for the single scene.

### Gen:scene-dsl path
The `gen:scene-dsl` script path in `package.json` may need adjustment. Run `pnpm --filter @brewsite/website gen:scene-dsl` and check for errors before starting dev server.

### Multiple ScenePlayers scroll correctness
Multiple ScenePlayers on one page work because `useEngineScroll` computes progress relative to each player's `scrollRegionRef` element position using `getBoundingClientRect()`. Tested pattern: place ScenePlayers sequentially in the document, each creates its own tall scroll region, each independently tracks its own progress. No additional configuration needed.

### CSS for `<code>` inline
In act headers, `<code>` tags appear inline. Add this to `style.css`:
```css
code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  color: var(--text-code-blue);
  background: rgba(121, 192, 255, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}
```

### Mobile layout
On mobile, ScenePlayers take full viewport width and the act header sections stack naturally above/below. The primary mobile concern is that `hero-bezel` looks correct at small widths — the `inset: 15% 8%` values may need responsive adjustment.

### TypeScript strict mode
All files must satisfy `tsc --strict`. Key issues to watch:
- `scene_01_meeting.tsx` imports constants from examples — these must be copied/duplicated, not cross-referenced across apps
- `ModelRouter` type prop must match types registered in `siteResources.ts`
- The `DiagramCanvas` `theme` prop type must match the actual export type from `@brewsite/diagram`
