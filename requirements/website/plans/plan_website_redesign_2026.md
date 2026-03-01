---
title: "Website Redesign 2026 — Implementation Plan"
doc_type: plan
status: active
owner: Toolkit Product
last_updated: 2026-03-01
---

# Website Redesign 2026 — Implementation Plan

## Overview

This plan covers the complete redesign of `apps/website` to implement the updated PRD (`prd_website_landing.md` v2). The changes are:

1. **Mobile-first** — portrait 9:16 is the primary design target; all cameras, layouts, and font sizes designed for phones first
2. **Updated messaging** — "Scenes as React. Rendered like film." / "The React toolkit for 3D storytelling."
3. **Hero Beat 2** — positioning statement appears in upper bezel after neon sign reveals
4. **Ecosystem act** — new Act 2 replaces the Libraries/HUD internal scenes
5. **Models compressed** — 2 model scenes → 1 with extended HUD progression
6. **Mobile scene parameters** — `isMobile` constants for cameras, PAIR_COUNT, mirror resolution, diagram scale

The site must work on 2024 phones (A17 Pro / Snapdragon 8 Gen 3 baseline). Do not reduce quality conservatively — push the settings and only back off if testing reveals problems.

---

## Guiding Principles for Implementation

- **Mobile-first CSS**: write the base styles for 375–430px portrait, then use `@media (min-width: 768px)` for desktop overrides
- **`isMobile` is evaluated once**: import from `utils/viewport.ts`, do not re-compute it per scene
- **All inline `fontSize` in scene TSX**: must use `clamp(mobilePx, vwValue, desktopPx)` — no hardcoded px
- **All HUD position offsets** (`left: '5%'`, `top: '8%'`, etc.): keep percentage-based values; these naturally adapt to viewport size
- **Do not touch**: `apps/examples`, any file in `packages/`, `widgetSetup.ts`, `App.tsx`, the NeonSign widget files, the nav menu, `siteResources.ts`, `sceneAssets.ts`
- **100dvh**: use `min-height: 100vh; min-height: 100dvh;` everywhere `100vh` currently appears

---

## Implementation Order

Execute phases in order. Each phase is independently verifiable.

1. Shared viewport utility
2. CSS foundation (mobile-first reset)
3. Hero scene (scene_00_hero.tsx + hero.css)
4. Core scenes (scene_01, scene_02 — copy-only changes)
5. New ecosystem scene (scene_03_ecosystem.tsx)
6. Model scene (compress + mobile camera)
7. Meeting scene (mobile camera + PAIR_COUNT)
8. Diagram scenes (cameras + scale)
9. Architecture scenes (cameras + scale)
10. Full stack scenes (cameras + copy)
11. GitHub CTA scene (command + copy)
12. websiteFlow.tsx (wire everything together)
13. LandingPage.tsx (quality setting)
14. Typography audit (verify all clamp() usage)

---

## Phase 1: Shared Viewport Utility

**Create:** `apps/website/src/utils/viewport.ts`

```typescript
/**
 * Evaluated once at module load time (browser SPA — window is always available).
 * Use this constant to branch on mobile-specific camera positions, PAIR_COUNT,
 * mirror resolution, diagram scale, etc.
 */
export const isMobile: boolean =
  typeof window !== 'undefined' && window.innerWidth < 768;
```

No imports. No side effects. Pure constant export.

---

## Phase 2: CSS Foundation (Mobile-First Reset)

### `apps/website/src/style.css` — Replace the Responsive section

The current `@media (max-width: 768px)` block at the bottom has 3 rules. Replace it with the comprehensive mobile-first responsive section below.

**Find and replace** the existing responsive block:

```css
/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .act-header__watermark { display: none; }
  .code-block { font-size: 12px; }
  .act-header__title { font-size: clamp(24px, 6vw, 36px); }
}
```

**Replace with:**

```css
/* ─── Responsive (mobile-first) ──────────────────────────────────────────── */

/* Base: designed for 375–430px portrait phones */
.act-header__watermark { display: none; }

.act-content-panel {
  max-width: 100%;
  padding: 24px;
}

.github-section {
  padding: 60px 24px;
  gap: 32px;
}

.terminal-card__body {
  padding: 18px 20px;
  font-size: 13px;
}

/* Touch target minimum for nav links */
.nav-link {
  padding: 14px 4px;
  min-height: 44px;
}

/* Desktop overrides */
@media (min-width: 768px) {
  .act-header__watermark { display: block; }

  .act-content-panel {
    max-width: 460px;
    padding: var(--section-pad-x);
  }

  .github-section {
    padding: var(--section-pad-y) var(--section-pad-x);
    gap: 48px;
  }

  .terminal-card__body {
    padding: 24px 28px;
    font-size: 14px;
  }

  .nav-link {
    padding: 12px 4px;
    min-height: auto;
  }
}

/* ─── 100dvh fix (dynamic viewport height for mobile browser chrome) ──────── */
.hero-section {
  min-height: 100vh;
  min-height: 100dvh;
}
```

### `apps/website/src/landing/hero/hero.css` — Add mobile-first rules

Add the following **at the end** of `hero.css`:

```css
/* ─── Hero mobile-first adjustments ─────────────────────────────────────── */

/* Bezel: percentage-based inset already adapts.
   On very small phones (< 380px), tighten slightly. */
@media (max-width: 380px) {
  .hero-bezel {
    inset: 12% 5%;
  }
}

/* Package badges: wrap to 2×2 on narrow screens */
.hero-packages {
  flex-wrap: wrap;
  justify-content: center;
  max-width: 400px;
  gap: 10px;
}

/* ─── Hero Statement (Beat 2) ─────────────────────────────────────────────── */
.hero-statement {
  position: absolute;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 5;
  pointer-events: none;
  width: 90%;
  max-width: 560px;
}

.hero-statement__eyebrow {
  display: block;
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(0, 245, 255, 0.65);
  margin-bottom: 10px;
}

.hero-statement__headline {
  font-size: clamp(36px, 9vw, 72px);
  font-weight: 700;
  line-height: 1.0;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #f0f6fc 20%, #00f5ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 14px;
}

.hero-statement__tagline {
  display: block;
  font-size: clamp(11px, 1.4vw, 14px);
  font-family: var(--font-mono);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(240, 246, 252, 0.45);
}

/* ─── Chart badge "soon" indicator ──────────────────────────────────────── */
.hero-package-badge--soon {
  position: relative;
  opacity: 0.7;
}

.hero-package-badge__soon-label {
  display: inline-block;
  margin-left: 6px;
  font-size: 9px;
  letter-spacing: 0.08em;
  color: rgba(255, 170, 0, 0.85);
  vertical-align: middle;
}

/* ─── Ecosystem scene cards ───────────────────────────────────────────────── */
.ecosystem-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  width: 100%;
  max-width: 520px;
  padding: 0 20px;
  box-sizing: border-box;
}

.ecosystem-card {
  border: 1px solid rgba(0, 245, 255, 0.18);
  background: rgba(0, 245, 255, 0.05);
  border-radius: 8px;
  padding: 16px 16px;
}

.ecosystem-card__name {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--neon-cyan);
  margin-bottom: 8px;
}

.ecosystem-card__headline {
  font-size: clamp(14px, 2vw, 16px);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 1.2;
}

.ecosystem-card__body {
  font-size: clamp(12px, 1.4vw, 13px);
  color: rgba(240, 246, 252, 0.5);
  line-height: 1.55;
}

.ecosystem-card__soon {
  margin-top: 10px;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  color: rgba(255, 170, 0, 0.75);
}

@media (min-width: 768px) {
  .ecosystem-grid {
    gap: 16px;
    max-width: 560px;
    padding: 0;
  }

  .ecosystem-card {
    padding: 18px 20px;
  }
}
```

---

## Phase 3: Hero Scene

### `apps/website/src/scenes/act0/scene_00_hero.tsx` — Full rewrite

Replace the entire file with the following:

```tsx
import type { JSX, ReactNode } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorMirror,
  ProgressManager,
  useEngineState,
} from '@brewsite/core';
import { NeonSign } from '../../widgets/neon-sign';
import { HeroBezel } from '../../landing/hero/HeroBezel';
import { ScrollIndicator } from '../../landing/hero/ScrollIndicator';
import { isMobile } from '../../utils/viewport';

/**
 * Fades children in as sceneProgress advances from `start` to `end`.
 */
function HeroFade({
  children,
  start,
  end,
}: {
  children: ReactNode;
  start: number;
  end: number;
}): JSX.Element {
  const { sceneProgress } = useEngineState();
  const opacity = Math.max(0, Math.min(1, (sceneProgress - start) / Math.max(end - start, 0.001)));
  return <div style={{ opacity }}>{children}</div>;
}

const MIRROR_RES = isMobile ? 512 : 1024;

export const scene00Hero: JSX.Element = (
  <Scene id="website-hero-00">
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 3, max: 0.80, pauseOnScroll: true }}
      animationTimeScale={3}
    />
    <Camera mode="world" position={[0, 7, 17]} target={[0, 1.4, 0]} fov={52} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.2} color="#09111f" />
      <Directional intensity={0.4} color="#9ed7ff" position={[8, 12, 12]} />
      <Directional intensity={0.3} color="#ffb366" position={[-12, 10, 6]} />
    </Lighting>
    <Floor enabled position={[0, 1, 0]}>
      <FloorMirror
        mirrorColor="#050910"
        mirrorOpacity={0.2}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>
    <NeonSign
      enabled
      text="BrewSite"
      fontUrl="/fonts/DancingScript-Bold.woff"
      position={[0, 0, 0]}
      rotation={[-Math.PI / 8, 0, 0]}
      scale={1}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={1}
    />
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      <section className="hero-section">
        <HeroBezel />

        {/* Beat 2: Positioning statement — appears in upper bezel zone after sign is lit */}
        <HeroFade start={0.42} end={0.58}>
          <div className="hero-statement">
            <span className="hero-statement__eyebrow">The React toolkit for</span>
            <h1 className="hero-statement__headline">3D storytelling.</h1>
            <span className="hero-statement__tagline">Scenes as React. Rendered like film.</span>
          </div>
        </HeroFade>

        {/* Beat 3: Package badges */}
        <HeroFade start={0.52} end={0.65}>
          <div className="hero-content hero-content--below-sign">
            <div className="hero-packages">
              <span className="hero-package-badge">@brewsite/core</span>
              <span className="hero-package-badge">@brewsite/model</span>
              <span className="hero-package-badge">@brewsite/diagram</span>
              <span className="hero-package-badge hero-package-badge--soon">
                @brewsite/chart
                <span className="hero-package-badge__soon-label">↗ soon</span>
              </span>
            </div>
          </div>
        </HeroFade>

        {/* Beat 4: Scroll indicator */}
        <HeroFade start={0.63} end={0.75}>
          <ScrollIndicator />
        </HeroFade>
      </section>
    </div>
  </Scene>
);
```

**Notes:**
- `HeroSection.tsx` is no longer used by the scene (the scene owns all its overlay content). `HeroSection.tsx` can be left as-is (it's not imported by any scene) or deleted. Do not delete it yet — leave for cleanup.
- The old `.hero-tagline` paragraph element is removed. The tagline is now `.hero-statement__tagline` inside the Beat 2 block.
- The `rotationRelative` prop is removed from `<Floor>` — it was `[0,0,0]` (no-op).
- `MIRROR_RES` is `512` on mobile, `1024` on desktop.

---

## Phase 4: Core Scenes — Copy Update Only

### `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx`

**One change only** — the headline text. Find and replace:

```tsx
// FIND:
Scenes as JSX.<br />Rendered like film.

// REPLACE:
Scenes as React.<br />Rendered like film.
```

Also update the `fontSize` in the `<h2>` to ensure mobile safety. The current value is `clamp(36px, 5vw, 58px)` which is already responsive — no change needed there.

### `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx`

No changes needed. The content ("Pre-baked. Zero runtime cost." / O(1) sampling / feature tags) remains valid and correct.

---

## Phase 5: New Ecosystem Scene

### Create: `apps/website/src/scenes/act1_act2/scene_03_ecosystem.tsx`

```tsx
import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';

const PACKAGES = [
  {
    name: '@brewsite/core',
    headline: 'The engine.',
    body: 'Declarative scenes. Pre-baked transitions. O(1) playback.',
    soon: false,
  },
  {
    name: '@brewsite/model',
    headline: 'GLTF models.',
    body: 'Characters, animations, PBR materials. Drop in any GLTF.',
    soon: false,
  },
  {
    name: '@brewsite/diagram',
    headline: '3D diagrams.',
    body: 'Architecture, flows, systems. Themes and routed edges.',
    soon: false,
  },
  {
    name: '@brewsite/chart',
    headline: 'Data stories.',
    body: 'Charts and visualizations in 3D.',
    soon: true,
  },
] as const;

export const scene03Ecosystem: JSX.Element = (
  <Scene id="website-ecosystem-01">
    <ProgressManager
      scrollUnits={2000}
      autoAdvance={{ duration: 8, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.08} color="#000510" />
      <Directional intensity={0.4} color="#0066ff" position={[3, 8, 5]} />
      <Directional intensity={0.2} color="#00aaff" position={[-5, 4, 3]} />
    </Lighting>

    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px',
      boxSizing: 'border-box',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(0,245,255,0.6)',
          marginBottom: 14,
          textAlign: 'center' as const,
        }}>
          The Ecosystem
        </div>
        <h2 style={{
          fontSize: 'clamp(28px, 6vw, 52px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center' as const,
          marginBottom: 32,
        }}>
          One engine.<br />Four packages.
        </h2>
      </MidFade>

      <div className="ecosystem-grid">
        {PACKAGES.map((pkg, i) => (
          <SlideUp key={pkg.name} duration={800} delay={i * 110}>
            <div className="ecosystem-card">
              <div className="ecosystem-card__name">{pkg.name}</div>
              <div className="ecosystem-card__headline">{pkg.headline}</div>
              <div className="ecosystem-card__body">{pkg.body}</div>
              {pkg.soon && (
                <div className="ecosystem-card__soon">↗ coming soon</div>
              )}
            </div>
          </SlideUp>
        ))}
      </div>

      <SlideUp duration={900} delay={550}>
        <p style={{
          marginTop: 28,
          fontSize: 'clamp(12px, 1.5vw, 14px)',
          color: 'rgba(240,246,252,0.38)',
          textAlign: 'center' as const,
          maxWidth: 380,
          lineHeight: 1.6,
        }}>
          Install only what you need. All packages share the same declarative scene model.
        </p>
      </SlideUp>
    </div>
  </Scene>
);
```

### Delete these two files:
- `apps/website/src/scenes/act1_act2/scene_03_hud_is_react.tsx`
- `apps/website/src/scenes/act1_act2/scene_04_transitions.tsx`

---

## Phase 6: Model Scene — Compress + Mobile Camera

### `apps/website/src/scenes/act3/scene_01_model_wide.tsx` — Full rewrite

The close-up HUD content (PBR materials) is folded into this scene's second HUD phase using a longer `scrollUnits`. The close-up camera content is approximated by the HUD text; no separate scene is needed.

```tsx
import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import { ModelRouter } from '@brewsite/model';
import { MidFade, SlideUp, Fade } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';

const CAM_POS: Vec3 = isMobile ? [0, 8, 28] : [0, 8, 38];
const CAM_FOV = isMobile ? 65 : 55;

export const scene01ModelWide: JSX.Element = (
  <Scene id="website-model-01">
    <ProgressManager
      scrollUnits={2400}
      autoAdvance={{ duration: 9, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera mode="world" position={CAM_POS} target={[0, 5, 0]} fov={CAM_FOV} />

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
      scale={0.2}
      position={[0, 0, 0]}
      rotation={[0, 0.2, 0]}
    />

    {/* Phase 1: Drop a GLTF headline */}
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
          textTransform: 'uppercase' as const,
          color: 'rgba(240,246,252,0.4)',
          marginBottom: 10,
        }}>
          @brewsite/model
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 28px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.25,
        }}>
          Drop a GLTF.<br />Animate the world.
        </div>
      </MidFade>
    </div>

    {/* Phase 2: PBR materials detail */}
    <div style={{
      position: 'absolute',
      top: '8%',
      right: '5%',
      textAlign: 'right' as const,
      maxWidth: 300,
    }}>
      <Fade duration={900}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(255,102,0,0.7)',
          marginBottom: 10,
        }}>
          GLTF · PBR Materials
        </div>
      </Fade>
      <SlideUp duration={1000} delay={80}>
        <div style={{
          fontSize: 'clamp(18px, 2.5vw, 24px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 8,
        }}>
          Physically Based.<br />Floor-to-ceiling.
        </div>
      </SlideUp>
      <SlideUp duration={900} delay={200}>
        <div style={{
          fontSize: 'clamp(13px, 1.5vw, 15px)',
          color: 'rgba(240,246,252,0.55)',
          lineHeight: 1.6,
        }}>
          Metalness, roughness, normals —<br />
          the renderer handles it.<br />
          You handle the story.
        </div>
      </SlideUp>
    </div>
  </Scene>
);
```

### Delete:
- `apps/website/src/scenes/act3/scene_02_model_close.tsx`

---

## Phase 7: Meeting Scene — Mobile Camera + PAIR_COUNT

### `apps/website/src/scenes/act4/scene_01_meeting.tsx`

**Three changes:**

**1. Add import at the top:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**2. Replace the PAIR_COUNT constant:**
```tsx
// FIND:
const PAIR_COUNT = 15;

// REPLACE:
const PAIR_COUNT = isMobile ? 4 : 15;
```

**3. Replace the Camera element inside the scene JSX:**
```tsx
// FIND:
<Camera mode="world" position={[0, 34, 110]} target={[0, 0, 0]} fov={48} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 22, 70] : [0, 34, 110]) as Vec3}
  target={[0, 0, 0]}
  fov={isMobile ? 60 : 48}
/>
```

**4. Update the HUD inline font sizes** — find the HUD div at the bottom of the scene and update:

```tsx
// FIND:
<div style={{ fontSize: 26, fontWeight: 700, color: '#f0f6fc', marginBottom: 10 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 700, color: '#f0f6fc', marginBottom: 10 }}>
```

```tsx
// FIND:
<div style={{ fontSize: 16, color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
```

No other changes. The HUD copy "30 characters. 50 lines of JSX." stays exactly as-is.

---

## Phase 8: Diagram Scenes — Cameras + Scale

### `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx`

**Add import:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**Replace Camera:**
```tsx
// FIND:
<Camera mode="world" position={[0, 8, 40]} target={[0, 0, 0]} fov={55} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 10, 30] : [0, 8, 40]) as Vec3}
  target={[0, 0, 0]}
  fov={isMobile ? 65 : 55}
/>
```

**Replace DiagramCanvas scale:**
```tsx
// FIND:
<DiagramCanvas
  id="simple-tech-stack"
  rotation={[-Math.PI / 12, 0, 0]}
  scale={1.3}
  theme={neonCyberTheme}
>

// REPLACE:
<DiagramCanvas
  id="simple-tech-stack"
  rotation={[-Math.PI / 12, 0, 0]}
  scale={isMobile ? 1.0 : 1.3}
  theme={neonCyberTheme}
>
```

**Update HUD copy** — find the headline and update:
```tsx
// FIND:
From whiteboard<br />to 3D in JSX.

// REPLACE:
From whiteboard<br />to 3D.
```

**Update HUD font sizes:**
```tsx
// FIND:
<div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc', marginBottom: 12 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 600, color: '#f0f6fc', marginBottom: 12 }}>
```

```tsx
// FIND:
<div style={{ fontSize: 14, color: 'rgba(240,246,252,0.6)', lineHeight: 1.65 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(13px, 1.6vw, 14px)', color: 'rgba(240,246,252,0.6)', lineHeight: 1.65 }}>
```

---

## Phase 9: Architecture Scenes — Cameras + Scale

### `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx`

**Add import:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**Replace Camera:**
```tsx
// FIND:
<Camera mode="world" fov={55} position={[0, 10, 50]} target={[0, 0, 0]} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 8, 38] : [0, 10, 50]) as Vec3}
  target={[0, 0, 0]}
  fov={isMobile ? 65 : 55}
/>
```

**Replace DiagramCanvas scale:**
```tsx
// FIND:
<DiagramCanvas id="system-canvas" rotation={[-Math.PI / 8, 0, 0]} scale={1.4} theme={darkGlassTheme}>

// REPLACE:
<DiagramCanvas id="system-canvas" rotation={[-Math.PI / 8, 0, 0]} scale={isMobile ? 1.0 : 1.4} theme={darkGlassTheme}>
```

**Update HUD font sizes:**
```tsx
// FIND (top-right HUD):
<div style={{ fontSize: 20, fontWeight: 600, color: '#f0f6fc' }}>

// REPLACE:
<div style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', fontWeight: 600, color: '#f0f6fc' }}>
```

```tsx
// FIND (bottom-left HUD):
<div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc' }}>

// REPLACE:
<div style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 600, color: '#f0f6fc' }}>
```

### `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx`

**Add import:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**Replace Camera:**
```tsx
// FIND:
<Camera mode="world" fov={55} position={[0, 8, 45]} target={[0, -5, 0]} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 8, 35] : [0, 8, 45]) as Vec3}
  target={[0, -5, 0]}
  fov={isMobile ? 65 : 55}
/>
```

**Replace DiagramCanvas scale:**
```tsx
// FIND:
<DiagramCanvas id="system-canvas" rotation={[-Math.PI / 12, 0, 0]} scale={1.4} theme={darkGlassTheme}>

// REPLACE:
<DiagramCanvas id="system-canvas" rotation={[-Math.PI / 12, 0, 0]} scale={isMobile ? 1.0 : 1.4} theme={darkGlassTheme}>
```

**Update HUD font sizes (bottom-right):**
```tsx
// FIND:
<div style={{ fontSize: 18, fontWeight: 600, color: '#f0f6fc', lineHeight: 1.35 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 600, color: '#f0f6fc', lineHeight: 1.35 }}>
```

---

## Phase 10: Full Stack Scenes — Cameras + Copy

### `apps/website/src/scenes/act7/scene_01_foundation.tsx`

**Add import:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**Replace Camera:**
```tsx
// FIND:
<Camera mode="world" position={[0, 12, 55]} target={[0, 4, 0]} fov={58} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 10, 40] : [0, 12, 55]) as Vec3}
  target={[0, 4, 0]}
  fov={isMobile ? 65 : 58}
/>
```

**Update headline copy:**
```tsx
// FIND:
One framework.<br />Every medium.

// REPLACE:
One engine.<br />Infinite forms.
```

**Update headline font size** (the `clamp` is already there — check it reads):
The current value is `clamp(36px, 5.5vw, 62px)` — this is fine as-is.

### `apps/website/src/scenes/act7/scene_02_combined.tsx`

**Add import:**
```tsx
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
```

**Replace Camera:**
```tsx
// FIND:
<Camera mode="world" position={[-8, 14, 55]} target={[5, 3, -5]} fov={60} />

// REPLACE:
<Camera
  mode="world"
  position={(isMobile ? [0, 12, 45] : [-8, 14, 55]) as Vec3}
  target={[5, 3, -5]}
  fov={isMobile ? 65 : 60}
/>
```

**Update HUD font sizes (bottom-left):**
```tsx
// FIND:
<div style={{ fontSize: 26, fontWeight: 700, color: '#f0f6fc', lineHeight: 1.25 }}>

// REPLACE:
<div style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: '#f0f6fc', lineHeight: 1.25 }}>
```

---

## Phase 11: GitHub CTA Scene

### `apps/website/src/scenes/act8/scene_01_github.tsx`

**Update terminal command** (line inside `terminal-card__body`):
```tsx
// FIND:
<span className="terminal-card__command">{' '}pnpm add @brewsite/core @brewsite/diagram</span>

// REPLACE:
<span className="terminal-card__command">{' '}pnpm add @brewsite/core @brewsite/model @brewsite/diagram</span>
```

**Update terminal output line:**
```tsx
// FIND:
<div className="terminal-card__output">added 2 packages in 0.9s</div>

// REPLACE:
<div className="terminal-card__output">added 3 packages in 1.2s</div>
```

**Update the CTA body copy:**
```tsx
// FIND:
<p className="github-cta-block__body">
  Built for TypeScript. Designed for developers. Author scenes in JSX, ship immersive
  3D experiences for the web, presentations, and marketing sites.
</p>

// REPLACE:
<p className="github-cta-block__body">
  Built for TypeScript. Powered by React. Install the engine, then add only what
  your story needs.
</p>
```

---

## Phase 12: websiteFlow.tsx — Wire Everything

### `apps/website/src/scenes/websiteFlow.tsx` — Full rewrite

```tsx
import { Fragment } from 'react';
import type { JSX } from 'react';
import { scene00Hero } from './act0/scene_00_hero';
import { scene01CoreIntro } from './act1_act2/scene_01_core_intro';
import { scene02CoreBaked } from './act1_act2/scene_02_core_baked';
import { scene03Ecosystem } from './act1_act2/scene_03_ecosystem';
import { scene01ModelWide } from './act3/scene_01_model_wide';
import { scene01Meeting } from './act4/scene_01_meeting';
import { scene01SimpleDiagram } from './act5_act6/scene_01_simple_diagram';
import { scene02ArchOverview } from './act5_act6/scene_02_arch_overview';
import { scene03ArchDetail } from './act5_act6/scene_03_arch_detail';
import { scene01Foundation } from './act7/scene_01_foundation';
import { scene02Combined } from './act7/scene_02_combined';
import { scene01Github } from './act8/scene_01_github';

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteFlowScenes: JSX.Element[] = [
  <Fragment key="website-hero-00">{scene00Hero}</Fragment>,
  <Fragment key="website-core-01">{scene01CoreIntro}</Fragment>,
  <Fragment key="website-core-02">{scene02CoreBaked}</Fragment>,
  <Fragment key="website-ecosystem-01">{scene03Ecosystem}</Fragment>,
  <Fragment key="website-model-01">{scene01ModelWide}</Fragment>,
  <Fragment key="website-meeting-01">{scene01Meeting}</Fragment>,
  <Fragment key="website-diagram-simple">{scene01SimpleDiagram}</Fragment>,
  <Fragment key="website-arch-overview">{scene02ArchOverview}</Fragment>,
  <Fragment key="website-arch-detail">{scene03ArchDetail}</Fragment>,
  <Fragment key="website-full-01">{scene01Foundation}</Fragment>,
  <Fragment key="website-full-02">{scene02Combined}</Fragment>,
  <Fragment key="website-github-01">{scene01Github}</Fragment>,
];

export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'Hero',         sceneId: 'website-hero-00' },
  { num: '01', label: 'The Engine',   sceneId: 'website-core-01' },
  { num: '02', label: 'Ecosystem',    sceneId: 'website-ecosystem-01' },
  { num: '03', label: 'Models',       sceneId: 'website-model-01' },
  { num: '04', label: 'The Crowd',    sceneId: 'website-meeting-01' },
  { num: '05', label: 'Diagrams',     sceneId: 'website-diagram-simple' },
  { num: '06', label: 'Architecture', sceneId: 'website-arch-overview' },
  { num: '07', label: 'Full Stack',   sceneId: 'website-full-01' },
  { num: '08', label: 'GitHub',       sceneId: 'website-github-01' },
];
```

---

## Phase 13: LandingPage.tsx — Quality Setting

### `apps/website/src/landing/LandingPage.tsx`

**Add import at top:**
```tsx
import { isMobile } from '../utils/viewport';
```

**Update EngineProvider quality prop:**
```tsx
// FIND:
quality="balanced"

// REPLACE:
quality={isMobile ? 'balanced' : 'high'}
```

---

## Phase 14: Typography Audit

After all scene changes are complete, do a pass to verify no raw `fontSize` pixel values remain in scene HUD content. Search for the pattern:

```
fontSize: [0-9]+,
```

Any match that isn't already a `clamp()` string must be updated. The expected survivors after Phases 3–11 are:

| File | Value | Status |
|---|---|---|
| scene_01_core_intro.tsx | `clamp(36px, 5vw, 58px)` | ✓ already responsive |
| scene_02_core_baked.tsx | `clamp(20px, 2.5vw, 28px)` | ✓ already responsive |
| scene_03_ecosystem.tsx | `clamp(28px, 6vw, 52px)` | ✓ new scene, responsive |
| scene_01_model_wide.tsx | `clamp(20px, 3vw, 28px)` | ✓ updated in Phase 6 |
| scene_01_meeting.tsx | `clamp(20px, 3.5vw, 26px)` | ✓ updated in Phase 7 |
| scene_01_simple_diagram.tsx | `clamp(20px, 3vw, 24px)` | ✓ updated in Phase 8 |
| scene_02_arch_overview.tsx | `clamp(16px, 2.2vw, 20px)` | ✓ updated in Phase 9 |
| scene_02_combined.tsx | `clamp(20px, 3vw, 26px)` | ✓ updated in Phase 10 |
| scene_01_foundation.tsx | `clamp(36px, 5.5vw, 62px)` | ✓ already responsive |

Eyebrow lines (10–11px mono, letter-spaced) are intentionally fixed-size — they're decorative labels, not body text. Leave them at hardcoded 10–11px.

---

## File Inventory Summary

### Files Created
| Path | Purpose |
|---|---|
| `apps/website/src/utils/viewport.ts` | `isMobile` constant |
| `apps/website/src/scenes/act1_act2/scene_03_ecosystem.tsx` | New Act 2 ecosystem scene |

### Files Modified
| Path | Changes |
|---|---|
| `apps/website/src/style.css` | Mobile-first responsive overrides |
| `apps/website/src/landing/hero/hero.css` | hero-statement, ecosystem-grid, badge-soon styles |
| `apps/website/src/scenes/act0/scene_00_hero.tsx` | Beat 2, 4 packages, MIRROR_RES |
| `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` | JSX→React in headline |
| `apps/website/src/scenes/act3/scene_01_model_wide.tsx` | Mobile camera, extended HUD, merged close-up content |
| `apps/website/src/scenes/act4/scene_01_meeting.tsx` | Mobile camera + PAIR_COUNT |
| `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx` | Mobile camera, scale, copy |
| `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx` | Mobile camera, scale |
| `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx` | Mobile camera, scale |
| `apps/website/src/scenes/act7/scene_01_foundation.tsx` | Mobile camera, copy |
| `apps/website/src/scenes/act7/scene_02_combined.tsx` | Mobile camera, font sizes |
| `apps/website/src/scenes/act8/scene_01_github.tsx` | Terminal command, body copy |
| `apps/website/src/scenes/websiteFlow.tsx` | Updated imports and scene/nav arrays |
| `apps/website/src/landing/LandingPage.tsx` | Quality prop via isMobile |

### Files Deleted
| Path | Reason |
|---|---|
| `apps/website/src/scenes/act1_act2/scene_03_hud_is_react.tsx` | Replaced by ecosystem scene |
| `apps/website/src/scenes/act1_act2/scene_04_transitions.tsx` | Replaced by ecosystem scene |
| `apps/website/src/scenes/act3/scene_02_model_close.tsx` | Content merged into model_wide |

### Files Left Alone (do not touch)
- `apps/website/src/landing/hero/HeroBezel.tsx` — no changes
- `apps/website/src/landing/hero/ScrollIndicator.tsx` — no changes
- `apps/website/src/landing/hero/HeroSection.tsx` — orphaned but harmless; do not delete
- `apps/website/src/landing/nav/NavMenu.tsx` — no changes
- `apps/website/src/widgetSetup.ts` — no changes
- `apps/website/src/App.tsx` — no changes
- `apps/website/src/widgets/neon-sign/**` — no changes
- `apps/website/siteResources.ts` — no changes
- All `apps/website/src/generated/**` — no changes
- All `packages/**` — no changes
- All `apps/examples/**` — no changes

---

## Testing Checklist

Execute after implementation:

**Mobile (use Chrome DevTools → iPhone 16 Pro portrait, 393×852):**
- [ ] Hero: neon sign powers on, Beat 2 positioning statement fades in at top of bezel
- [ ] "3D storytelling." headline is fully visible and readable, not clipped
- [ ] All 4 package badges visible in 2×2 layout
- [ ] Scroll indicator appears and is not behind browser chrome (100dvh)
- [ ] Act 2 Ecosystem: 4 cards in 2×2 grid, legible text, no overflow
- [ ] Act 3 Models: Worker model visible and framed, not cut off
- [ ] Act 4 Meeting: 8 characters visible; camera frames the crowd
- [ ] Act 5 Simple diagram: 5 nodes visible with labels readable
- [ ] Act 6 Architecture: Multi-tier diagram visible without nodes too small to read
- [ ] Act 7 Full stack: Both model and diagram visible in combined scene
- [ ] Act 8 GitHub: Terminal card fits viewport, text not truncated
- [ ] No horizontal scrollbar at any act
- [ ] Hamburger nav opens; all nav links are tappable (min 44px height)

**Desktop (Chrome, 1440×900):**
- [ ] Hero: Beat 2 positioning statement positioned in upper bezel, sign visible below
- [ ] All scenes: 30 characters in meeting scene
- [ ] Diagram scenes: scale 1.4 compositions look correct
- [ ] Combined full-stack scene: offset camera composition (model left, diagram right)
- [ ] No regression on existing desktop layout

**Cross-browser:**
- [ ] Safari iOS 17+ — hero neon sign renders, WebGL scenes load
- [ ] Chrome Android — all scenes render, scroll advances scenes

**Console:**
- [ ] Zero `console.error` on any scene transition
- [ ] TypeScript build passes: `pnpm --filter @brewsite/website typecheck`

---

## Notes for the Implementing Engineer

1. **`isMobile` at module scope is safe in this SPA**: all modules are imported after `window` is available. There is no SSR in `apps/website`.

2. **`Vec3` cast**: the `isMobile ? [...] : [...]` ternary returns `number[]` not `Vec3`. Cast with `as Vec3` at the prop site, not with a separate `const`.

3. **The `Fade` import**: `scene_01_model_wide.tsx` now uses `Fade` (for the PBR phase). Ensure it's imported: `import { MidFade, SlideUp, Fade } from '@brewsite/core/hud/animejs';`

4. **CSS class colocation**: The `.ecosystem-grid`, `.ecosystem-card`, `.hero-statement` classes are defined in `hero.css` for now. If the CSS file grows unwieldy, consider extracting to a co-located `ecosystem.css`. For this implementation, keeping everything in `hero.css` is acceptable.

5. **The `@brewsite/chart` badge**: It uses `.hero-package-badge--soon` class modifier. The base `.hero-package-badge` styles already exist; only the modifier and the inner `__soon-label` span are new.

6. **Don't guess on camera values**: The mobile camera values in this plan are design specifications. If physical device testing reveals a composition issue (model cut off, diagram too small to read), adjust the values to fix the issue — but document what was changed and why.

7. **Two-phase HUD in model scene**: The model scene now has two HUD blocks (top-left: "Drop a GLTF", top-right: "Physically Based"). Both are wrapped in their own animation components (`MidFade` + `SlideUp`). The animation system will trigger both on scene entry. On a longer scene (`scrollUnits={2400}`), the visitor has time to read both before scrolling on.
