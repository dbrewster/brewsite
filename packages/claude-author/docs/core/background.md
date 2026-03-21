---
title: Background Element DSL Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## Background Overview

The `<Background>` element controls a CSS DOM layer rendered behind the Three.js canvas. It supports solid colors, CSS gradients, image URLs, CSS filters, and overlay gradients. It is an ambient DSL element — it does not occupy an NVS position.

**`<Background>` vs `<BackgroundLayer>`:** `<Background>` is the scene DSL component you declare inside `<Scene>`. `BackgroundLayer` is the player-level React component you mount in your page layout. The two are connected: `BackgroundLayer` reads the compiled `SceneBackground` state from the engine each frame and applies it to the DOM. Scene authors only use `<Background>`.

Import from `@brewsite/core`:

```tsx
import { Background } from '@brewsite/core';
```

In your page layout, `BackgroundLayer` must be present for `<Background>` to render:

```tsx
import { BackgroundLayer } from '@brewsite/core';

// Inside ScrollStage or the canvas container:
<BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
<SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
```

---

## Background Props

```tsx
<Background
  color="#030510"          // solid CSS color
  gradient={undefined}     // CSS gradient string — overrides color/imageUrl
  imageUrl={undefined}     // image URL for CSS background-image
  opacity={1}              // [0..1] opacity of the background element
  cssPosition="center"     // CSS background-position
  cssSize="cover"          // CSS background-size
  cssRepeat="no-repeat"    // CSS background-repeat
  cssFilter={undefined}    // CSS filter on the background element
  overlayGradient={undefined}   // CSS gradient on overlay element above background
  backdropFilter={undefined}    // CSS backdrop-filter on overlay element
  theme={undefined}        // SceneTheme — derives fill and effects when set
/>
```

**Fill hierarchy (first non-undefined wins):**
1. `gradient` prop (explicit CSS gradient string)
2. `imageUrl` prop (image URL)
3. `color` prop (solid color)
4. `theme.background.fill` (derived from SceneTheme)

**Effects hierarchy (explicit prop wins over theme-derived):**
- `cssFilter`, `overlayGradient`, `backdropFilter` — explicit props override theme values

| Prop | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | — | CSS background color (e.g. `'#0a0a14'`) |
| `gradient` | `string` | — | CSS gradient string. Takes precedence over `color` and `imageUrl` |
| `imageUrl` | `string` | — | CSS `background-image` URL |
| `opacity` | `number` | 1 | Background element opacity [0..1] |
| `cssPosition` | `string` | — | CSS `background-position` (e.g. `'center top'`) |
| `cssSize` | `string` | — | CSS `background-size` (e.g. `'cover'`, `'100% auto'`) |
| `cssRepeat` | `string` | — | CSS `background-repeat` (e.g. `'no-repeat'`) |
| `cssFilter` | `string` | — | CSS `filter` on the background element (e.g. `'blur(4px) brightness(0.8)'`) |
| `overlayGradient` | `string` | — | CSS gradient on a second overlay element above the background but below content |
| `backdropFilter` | `string` | — | CSS `backdrop-filter` on the overlay element (e.g. `'blur(12px)'`) |
| `theme` | `SceneTheme` | — | Optional SceneTheme. Per-element explicit props override theme values. Resolved at compile time — not stored in compiled state |

---

## Background Transitions

Between scenes, `<Background>` transitions are handled by the compiler:

- **`opacity`** interpolates smoothly.
- When changing `imageUrl`, the compiler crossfades: the outgoing background fades to opacity 0, then the incoming fades from 0 to the target opacity (split at the midpoint).
- When the same `imageUrl` appears in both scenes, opacity interpolates directly.
- `color`, `gradient`, `cssFilter`, `overlayGradient`, `backdropFilter`, and other string props **switch at the midpoint** — they cannot be interpolated and are swapped discretely.

**Example — dark to slightly lighter scene:**

```tsx
// Scene A
<Background color="#030510" />

// Scene B — color switches at midpoint of transition
<Background color="#080818" />
```

**Example — fading background to reveal a different gradient:**

```tsx
// Scene A
<Background gradient="radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%)" />

// Scene B — gradient switches at midpoint. Use opacity transition for a smooth feel.
<Background
  gradient="radial-gradient(circle at 50% 100%, #2d1f6b 0%, #120836 42%, #02040a 100%)"
  opacity={1}
/>
```

---

## Common Background Patterns

### Solid dark background

```tsx
<Background color="#030510" />
```

### Deep space gradient

```tsx
<Background
  gradient="radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)"
/>
```

### Image with blur filter

```tsx
<Background
  imageUrl="/assets/backgrounds/nebula.jpg"
  cssSize="cover"
  cssPosition="center"
  cssFilter="blur(4px) brightness(0.6)"
/>
```

### Dark gradient + top-vignette overlay

```tsx
<Background
  color="#0a0a14"
  overlayGradient="linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)"
/>
```

### Frosted glass overlay

```tsx
<Background
  color="#0d1220"
  overlayGradient="linear-gradient(180deg, rgba(0,0,20,0.4) 0%, rgba(0,0,0,0.1) 100%)"
  backdropFilter="blur(8px)"
/>
```

### Theme-derived background

When you set `theme` on `SceneEngine`, you can omit explicit background props and let the theme system derive the fill:

```tsx
// SceneEngine sets theme={{ family: 'darkGlass', polarity: 'dark' }}
// Scene derives background from theme — no explicit Background prop needed.
// Or explicitly opt into theme:
<Background theme={mySceneTheme} />
```

Per-element explicit props always override theme-derived values.

### Polarity-aware pattern

```tsx
// Use a resolver function for polarity-aware fills without hardcoding:
const polarity: 'dark' | 'light' = 'dark';

<Background color={polarity === 'dark' ? '#030510' : '#f5f5f7'} />
```
