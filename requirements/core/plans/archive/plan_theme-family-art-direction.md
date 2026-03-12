---
title: "Theme Family Art Direction — Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-03-12
---

# Theme Family Art Direction — Implementation Plan

## Scope Summary

This plan covers the genuine remaining work as defined by the PM-2 Consensus Summary in `requirements/core/notes/note_theme-family-art-direction.md`. The following are **explicitly descoped** and require no code changes:

| Item | Reason |
|---|---|
| `@brewsite/core` (`presets.ts`) | All 12 SceneTheme presets are complete and match the spec. |
| `@brewsite/slides` (`themeFamily.ts`) | Already shipped and complete. |
| `webglFontUrl` per family | CDN/hosting dependency; separate track. |
| `background.effects.overlayGradient` type change | Not needed; field exists in `types.ts`. |

---

## Independence Guarantee

The four parallel work streams touch zero shared files:

| Stream | Files | Overlap |
|---|---|---|
| **A** — `charts-theme` | 9 files in `packages/charts/src/themes/` | Zero overlap with B, C, or D |
| **B** — `diagram-theme` | 0 files (all values verified correct) | Zero overlap with A, C, or D |
| **C** — `export-promotion` | 2 root index files | Zero overlap with A, B, or D |
| **D** — `theme-gallery` | 3 new files in `apps/examples/src/theme-gallery/` + 1 edit to `App.tsx` | Zero overlap with A, B, or C |

All four streams are safe to implement in parallel.

---

## Material Value Authority Table (PM-2 Consensus)

When the note and code diverge on chart series material tokens, apply these authorities:

| Token | Authority | Applies To |
|---|---|---|
| Dark `roughness` | **Code (`0.12` for darkGlass)** | darkGlass dark only — other families differ |
| Light `metalness` | **Note** | Apply `0.10` (darkGlass light). Other light families already correct. |
| Light `roughness` | **Note** | Apply `0.34` (darkGlass light). Other light families already correct. |
| All other material values | Match (no change) | — |

---

## Stream A — `charts-theme`

**Package:** `packages/charts/src/themes/`
**Files to modify:** 9 files (listed below)
**Files unchanged:** `darkGlass.ts`, `neonCyber.ts`, `neonCyberLight.ts` (all values already match spec)

### A.1 — `darkGlassLight.ts`

**Problem:** Series `metalness` is `0.50` (should be `0.10`); `roughness` is `0.14` (should be `0.34`). PM-2 confirmed `0.50` metalness creates dark mirror-like surfaces on light backgrounds — implementation error.

**Change:** Replace all 8 series entries with corrected metalness and roughness. All other fields (color, transmission, emissiveIntensity, depth) remain unchanged.

**Current series block:**
```typescript
series: [
  { color: '#B33A2B', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.04, depth: 0.18 },
  { color: '#E36A2E', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.05, depth: 0.18 },
  { color: '#7A1F2D', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.03, depth: 0.18 },
  { color: '#2E4F7A', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#5A2C1D', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#FF8A3D', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.06, depth: 0.18 },
  { color: '#8F3B4A', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#1E3554', metalness: 0.50, roughness: 0.14, transmission: 0.02, emissiveIntensity: 0.01, depth: 0.18 },
],
```

**Replacement series block:**
```typescript
series: [
  { color: '#B33A2B', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.04, depth: 0.18 },
  { color: '#E36A2E', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.05, depth: 0.18 },
  { color: '#7A1F2D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.03, depth: 0.18 },
  { color: '#2E4F7A', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#5A2C1D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#FF8A3D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.06, depth: 0.18 },
  { color: '#8F3B4A', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
  { color: '#1E3554', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.01, depth: 0.18 },
],
```

No other changes to this file.

---

### A.2 — `midnight.ts` (dark variant)

**Problem:** Confirmed copy-paste error — the tooltip and projection contain blue colors (`rgba(107,155,255,0.3)`, `#6B9BFF`) on a warm amber/terracotta family. Must be replaced with amber-family values.

**Change:** Replace the `tooltip` block and `projection` block in full.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(6,8,24,0.94)',
  blur: '10px',
  borderColor: 'rgba(107,155,255,0.3)',
  borderRadius: '6px',
  valueColor: '#C8D8FF',
  labelColor: 'rgba(200,216,255,0.6)',
  fontSize: 12,
  shadow: '0 4px 20px rgba(0,0,0,0.6)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(13,9,7,0.94)',
  blur: '8px',
  borderColor: 'rgba(226,163,58,0.30)',
  borderRadius: '6px',
  valueColor: '#F0E4CF',
  labelColor: 'rgba(240,228,207,0.65)',
  fontSize: 12,
  shadow: '0 4px 16px rgba(0,0,0,0.55)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block:**
```typescript
projection: {
  color: '#6B9BFF',
  emissiveIntensity: 1.0,
  beamWidth: 0.005,
  opacity: 0.88,
  dotRadius: 0.024,
  dotEmissiveIntensity: 1.2,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#E2A33A',
  emissiveIntensity: 0.85,
  beamWidth: 0.004,
  opacity: 0.88,
  dotRadius: 0.022,
  dotEmissiveIntensity: 1.10,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.3 — `midnightLight.ts` (light variant)

**Problem:** Same copy-paste error — blue tooltip/projection values (`rgba(79,100,200,0.25)`, `#4F64C8`) on warm amber family.

**Change:** Replace the `tooltip` block and `projection` block in full.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(242,244,255,0.96)',
  blur: '6px',
  borderColor: 'rgba(79,100,200,0.25)',
  borderRadius: '6px',
  valueColor: '#1A2060',
  labelColor: 'rgba(26,32,96,0.55)',
  fontSize: 12,
  shadow: '0 2px 10px rgba(79,100,200,0.12)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(250,246,238,0.96)',
  blur: '6px',
  borderColor: 'rgba(170,120,58,0.28)',
  borderRadius: '6px',
  valueColor: '#3A2A1B',
  labelColor: 'rgba(58,42,27,0.58)',
  fontSize: 12,
  shadow: '0 2px 10px rgba(0,0,0,0.10)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block:**
```typescript
projection: {
  color: '#4F64C8',
  emissiveIntensity: 0.55,
  beamWidth: 0.004,
  opacity: 0.75,
  dotRadius: 0.022,
  dotEmissiveIntensity: 0.9,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#A7793A',
  emissiveIntensity: 0.55,
  beamWidth: 0.004,
  opacity: 0.75,
  dotRadius: 0.020,
  dotEmissiveIntensity: 0.85,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.4 — `enterprise.ts` (dark variant)

**Problem:** The `tooltip.background` is `rgba(255,255,255,0.96)` — a white background on a dark-polarity theme. This is a confirmed inconsistency. All dark-polarity themes must have dark tooltip backgrounds. The tooltip `valueColor` and `labelColor` are navy-on-white (readable on light but invisible on dark). The `projection.opacity` is `0.7` (spec: `0.72`).

**Change:** Replace the `tooltip` block and correct `projection.opacity`.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.96)',
  blur: '4px',
  borderColor: 'rgba(79,118,184,0.25)',
  borderRadius: '6px',
  valueColor: '#1A2A4A',
  labelColor: 'rgba(26,42,74,0.55)',
  fontSize: 12,
  shadow: '0 2px 8px rgba(0,0,0,0.1)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(10,20,36,0.94)',
  blur: '4px',
  borderColor: 'rgba(79,118,184,0.28)',
  borderRadius: '6px',
  valueColor: '#E3ECF8',
  labelColor: 'rgba(227,236,248,0.58)',
  fontSize: 12,
  shadow: '0 4px 14px rgba(0,0,0,0.45)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block (partial change):**
```typescript
projection: {
  color: '#4F76B8',
  emissiveIntensity: 0.5,
  beamWidth: 0.003,
  opacity: 0.7,       // <-- incorrect, must be 0.72
  dotRadius: 0.018,
  dotEmissiveIntensity: 0.8,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#4F76B8',
  emissiveIntensity: 0.50,
  beamWidth: 0.003,
  opacity: 0.72,
  dotRadius: 0.018,
  dotEmissiveIntensity: 0.80,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.5 — `enterpriseLight.ts` (light variant)

**Problem:** The `tooltip.borderColor`, `tooltip.valueColor`, and `tooltip.labelColor` use green-family colors (`rgba(63,127,115,...)`, `#0F3A34`) instead of the enterprise blue-navy family.

**Change:** Replace three tooltip fields. No changes to projection or series.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.97)',
  blur: '4px',
  borderColor: 'rgba(63,127,115,0.25)',
  borderRadius: '6px',
  valueColor: '#0F3A34',
  labelColor: 'rgba(15,58,52,0.55)',
  fontSize: 12,
  shadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.97)',
  blur: '4px',
  borderColor: 'rgba(79,118,184,0.22)',
  borderRadius: '6px',
  valueColor: '#1A2A4A',
  labelColor: 'rgba(26,42,74,0.55)',
  fontSize: 12,
  shadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

No other changes to this file.

---

### A.6 — `lightCanvas.ts` (light/canonical variant)

**Problem:** `tooltip.borderColor` (`rgba(90,138,106,0.25)`), `tooltip.valueColor` (`#1A3A28`), and `tooltip.labelColor` (`rgba(26,58,40,0.55)`) are green-family, not blue-family. `projection.color` (`#5A8A6A`) is also green.

**Change:** Replace three tooltip fields and `projection.color`.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.96)',
  blur: '4px',
  borderColor: 'rgba(90,138,106,0.25)',
  borderRadius: '6px',
  valueColor: '#1A3A28',
  labelColor: 'rgba(26,58,40,0.55)',
  fontSize: 12,
  shadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.96)',
  blur: '4px',
  borderColor: 'rgba(61,99,217,0.22)',
  borderRadius: '6px',
  valueColor: '#1A2A4A',
  labelColor: 'rgba(26,42,74,0.55)',
  fontSize: 12,
  shadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block (partial change):**
```typescript
projection: {
  color: '#5A8A6A',   // <-- green, must be blue
  emissiveIntensity: 0.5,
  beamWidth: 0.003,
  opacity: 0.7,
  dotRadius: 0.018,
  dotEmissiveIntensity: 0.8,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#3D63D9',
  emissiveIntensity: 0.50,
  beamWidth: 0.003,
  opacity: 0.70,
  dotRadius: 0.018,
  dotEmissiveIntensity: 0.80,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.7 — `lightCanvasDark.ts` (dark polarity variant)

**Problem:** `tooltip.background` (`rgba(18,26,20,0.93)`) is green-tinted (note the `20` green channel); `borderColor`, `valueColor`, `labelColor` are all green-family. `projection.color` is green; `projection.emissiveIntensity` is `0.75` (spec: `0.70`).

**Change:** Replace the `tooltip` block and `projection` block in full.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(18,26,20,0.93)',
  blur: '8px',
  borderColor: 'rgba(90,138,106,0.3)',
  borderRadius: '6px',
  valueColor: '#D4EAD8',
  labelColor: 'rgba(212,234,216,0.6)',
  fontSize: 12,
  shadow: '0 4px 16px rgba(0,0,0,0.4)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(18,26,38,0.94)',
  blur: '8px',
  borderColor: 'rgba(61,99,217,0.28)',
  borderRadius: '6px',
  valueColor: '#E8EEF7',
  labelColor: 'rgba(232,238,247,0.62)',
  fontSize: 12,
  shadow: '0 4px 16px rgba(0,0,0,0.40)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block:**
```typescript
projection: {
  color: '#5A8A6A',
  emissiveIntensity: 0.75,
  beamWidth: 0.003,
  opacity: 0.8,
  dotRadius: 0.018,
  dotEmissiveIntensity: 1.0,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#3D63D9',
  emissiveIntensity: 0.70,
  beamWidth: 0.003,
  opacity: 0.80,
  dotRadius: 0.018,
  dotEmissiveIntensity: 1.00,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.8 — `lightMinimal.ts` (light/canonical variant)

**Problem:** `tooltip.borderColor` (`rgba(180,180,180,0.3)`), `tooltip.valueColor` (`#111111`), `tooltip.labelColor` (`rgba(17,17,17,0.5)`) are generic grays with no family identity. `projection.color` (`#888888`) is also generic gray. `projection.opacity` (`0.6`, spec: `0.55`).

**Change:** Replace three tooltip fields, `projection.color`, and `projection.opacity`.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.97)',
  blur: '',
  borderColor: 'rgba(180,180,180,0.3)',
  borderRadius: '4px',
  valueColor: '#111111',
  labelColor: 'rgba(17,17,17,0.5)',
  fontSize: 12,
  shadow: '0 1px 6px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(255,255,255,0.97)',
  blur: '',
  borderColor: 'rgba(127,174,234,0.22)',
  borderRadius: '4px',
  valueColor: '#223248',
  labelColor: 'rgba(34,50,72,0.50)',
  fontSize: 12,
  shadow: '0 1px 6px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block (partial change):**
```typescript
projection: {
  color: '#888888',
  emissiveIntensity: 0.3,
  beamWidth: 0.003,
  opacity: 0.6,
  dotRadius: 0.016,
  dotEmissiveIntensity: 0.5,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#7FAEEA',
  emissiveIntensity: 0.30,
  beamWidth: 0.003,
  opacity: 0.55,
  dotRadius: 0.016,
  dotEmissiveIntensity: 0.50,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### A.9 — `lightMinimalDark.ts` (dark polarity variant)

**Problem:** `tooltip.borderColor` (`rgba(150,150,150,0.25)`), `tooltip.valueColor` (`#EEEEEE`), `tooltip.labelColor` (`rgba(238,238,238,0.55)`) are generic grays. `projection.color` (`#999999`) is generic gray. `projection.emissiveIntensity` (`0.45`, spec: `0.40`), `projection.opacity` (`0.65`, spec: `0.62`), `projection.dotEmissiveIntensity` (`0.7`, spec: `0.65`).

**Change:** Replace three tooltip fields and four projection fields.

**Current `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(16,16,18,0.94)',
  blur: '6px',
  borderColor: 'rgba(150,150,150,0.25)',
  borderRadius: '4px',
  valueColor: '#EEEEEE',
  labelColor: 'rgba(238,238,238,0.55)',
  fontSize: 12,
  shadow: '0 4px 16px rgba(0,0,0,0.4)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Replacement `tooltip` block:**
```typescript
tooltip: {
  background: 'rgba(16,16,18,0.94)',
  blur: '6px',
  borderColor: 'rgba(127,174,234,0.20)',
  borderRadius: '4px',
  valueColor: '#E8EDF5',
  labelColor: 'rgba(232,237,245,0.55)',
  fontSize: 12,
  shadow: '0 4px 16px rgba(0,0,0,0.40)',
  padding: '8px 12px',
  maxWidth: 220,
  offsetX: 12,
  offsetY: -12,
},
```

**Current `projection` block:**
```typescript
projection: {
  color: '#999999',
  emissiveIntensity: 0.45,
  beamWidth: 0.003,
  opacity: 0.65,
  dotRadius: 0.016,
  dotEmissiveIntensity: 0.7,
  animationDurationMs: 220,
},
```

**Replacement `projection` block:**
```typescript
projection: {
  color: '#7FAEEA',
  emissiveIntensity: 0.40,
  beamWidth: 0.003,
  opacity: 0.62,
  dotRadius: 0.016,
  dotEmissiveIntensity: 0.65,
  animationDurationMs: 220,
},
```

No other changes to this file.

---

### Stream A — Files NOT Changed (already correct)

The following chart theme files were audited and all values match the spec. No changes required:

| File | Verified Correct |
|---|---|
| `darkGlass.ts` | series materials, tooltip (ember amber family), projection |
| `neonCyber.ts` | series materials, tooltip (cyan/violet family), projection |
| `neonCyberLight.ts` | series materials (metalness 0.10 ✓, roughness 0.20 ✓), tooltip, projection |
| `midnight.ts` series | metalness 0.08 ✓, roughness 0.48 ✓, transmission 0.00 ✓ |
| `midnightLight.ts` series | metalness 0.06 ✓, roughness 0.40 ✓, depth 0.18 ✓ |

---

## Stream B — `diagram-theme`

**Package:** `packages/diagram/src/elements/diagram/themes/`
**Files to modify:** NONE

**Verification methodology:** Each of the 12 diagram theme files was read directly from disk. The values in those files were compared field-by-field against the authoritative spec values in note sections 5.x.4 (`glowIntensity`, `glowSpread`, `sideColorDarkenFactor`, `borderColorLightenFactor`) and 5.x.4 edge values (`defaultFlowSpeed`, `flowPulseIntensity`). The PM-2 consensus said "Align DiagramTheme.edge.defaultFlowSpeed/flowPulseIntensity to section 7 ranges" — the spec tables in sections 5.x.4 provide the exact per-family × polarity values that satisfy those section 7 ranges. Every one of those exact values is already present in the live code. **The code matches the spec; no changes are required.** A reviewer can independently verify this by comparing the audit table below against the source files.

All 12 diagram theme files were audited against spec sections 5.x.4 for glow/flow values. All values match:

| Family | File | glowIntensity | glowSpread | sideColorDarkenFactor | borderColorLightenFactor | defaultFlowSpeed | flowPulseIntensity |
|---|---|---|---|---|---|---|---|
| darkGlass dark | `darkGlass.ts` | `0.10` ✓ | `2.2` ✓ | `-0.15` ✓ | `0.20` ✓ | `0.30` ✓ | `0.68` ✓ |
| darkGlass light | `darkGlassLight.ts` | `0.0` ✓ | (inherits 2.2) ✓ | (inherits -0.15) ✓ | (inherits 0.20) ✓ | `0.24` ✓ | `0.58` ✓ |
| midnight dark | `midnight.ts` | `0.0` ✓ | `2.2` ✓ | `-0.15` ✓ | `0.20` ✓ | `0.24` ✓ | `0.58` ✓ |
| midnight light | `midnightLight.ts` | (inherits 0.0) ✓ | (inherits 2.2) ✓ | (inherits -0.15) ✓ | (inherits 0.20) ✓ | `0.20` ✓ | `0.46` ✓ |
| neonCyber dark | `neonCyber.ts` | `0.52` ✓ | `2.8` ✓ | `-0.15` ✓ | `0.25` ✓ | `0.82` ✓ | `1.0` ✓ |
| neonCyber light | `neonCyberLight.ts` | `0.06` ✓ | (inherits 2.8) ✓ | (inherits -0.15) ✓ | (inherits 0.25) ✓ | `0.65` ✓ | `0.86` ✓ |
| enterprise dark | `enterprise.ts` | `0.0` ✓ | `2.2` ✓ | `-0.15` ✓ | `0.25` ✓ | `0.08` ✓ | `0.28` ✓ |
| enterprise light | `enterpriseLight.ts` | (inherits 0.0) ✓ | (inherits 2.2) ✓ | (inherits -0.15) ✓ | (inherits 0.25) ✓ | `0.04` ✓ | `0.22` ✓ |
| lightCanvas light | `lightCanvas.ts` | `0.0` ✓ | `2.2` ✓ | `-0.08` ✓ | `0.15` ✓ | `0.22` ✓ | `0.26` ✓ |
| lightCanvas dark | `lightCanvasDark.ts` | (inherits 0.0) ✓ | (inherits 2.2) ✓ | (inherits -0.08) ✓ | (inherits 0.15) ✓ | `0.24` ✓ | `0.30` ✓ |
| lightMinimal light | `lightMinimal.ts` | `0.0` ✓ | `2.2` ✓ | `-0.10` ✓ | `0.20` ✓ | `0.06` ✓ | `0.16` ✓ |
| lightMinimal dark | `lightMinimalDark.ts` | (inherits 0.0) ✓ | (inherits 2.2) ✓ | (inherits -0.10) ✓ | (inherits 0.20) ✓ | `0.12` ✓ | `0.18` ✓ |

Node/edge/group color tokens were also audited. All match the spec sections 5.x.4. No code changes are needed for Stream B.

---

## Stream C — `export-promotion`

### C.1 — `packages/diagram/src/index.ts`

**Current state (themes section):**
```typescript
export { darkGlassTheme, neonCyberTheme, enterpriseTheme, lightMinimalTheme } from './elements/diagram/themes';
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';
```

**Problems:**
- `midnightTheme` and `lightCanvasTheme` are not exported from the package root
- None of the 6 polarity variants (`darkGlassLightTheme`, `midnightLightTheme`, `neonCyberLightTheme`, `enterpriseLightTheme`, `lightCanvasDarkTheme`, `lightMinimalDarkTheme`) are exported
- `DIAGRAM_THEME_PAIRS` and `DIAGRAM_THEMES` registries are not exported
- `DiagramThemePair` type is not exported

**Replacement themes section:**

Replace the current two-line themes block with:
```typescript
// ─── Diagram themes ───────────────────────────────────────────────────────────
// Primary (canonical) dark presets
export { darkGlassTheme, midnightTheme, neonCyberTheme, enterpriseTheme, lightCanvasTheme, lightMinimalTheme } from './elements/diagram/themes';
// Polarity variants
export { darkGlassLightTheme, midnightLightTheme, neonCyberLightTheme, enterpriseLightTheme, lightCanvasDarkTheme, lightMinimalDarkTheme } from './elements/diagram/themes';
// Theme registries and pair utilities
export { DIAGRAM_THEMES, DIAGRAM_THEME_PAIRS } from './elements/diagram/themes';
export type { DiagramThemePair } from './elements/diagram/themes';
// Theme composition helpers
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';
```

No other changes to this file.

---

### C.2 — `packages/charts/src/index.ts`

**Current state (themes section):**
```typescript
export { darkGlassChartTheme } from './themes/darkGlass';
export { neonCyberChartTheme } from './themes/neonCyber';
export { enterpriseChartTheme } from './themes/enterprise';
export { lightMinimalChartTheme } from './themes/lightMinimal';
export { createChartTheme } from './themes/createChartTheme';
export { CHART_THEMES } from './themes/index';
// ... various type exports ...
export {CHART_THEME_PAIRS} from './themes/index';
```

**Problems:**
- `midnightChartTheme` and `lightCanvasChartTheme` are not exported from package root
- None of the 6 polarity variants are exported from the root
- `ChartThemePair` type is not exported

**Precise edit instructions:**

Make three targeted changes to `packages/charts/src/index.ts`. Do **not** replace the file wholesale — three surgical edits only:

**Edit 1:** Replace the four individual dark-preset export lines (currently lines 133–136):
```typescript
// REMOVE these four lines:
export { darkGlassChartTheme } from './themes/darkGlass';
export { neonCyberChartTheme } from './themes/neonCyber';
export { enterpriseChartTheme } from './themes/enterprise';
export { lightMinimalChartTheme } from './themes/lightMinimal';
```
**With** this expanded block (6 dark presets + 6 polarity variants):
```typescript
// Primary (canonical) presets
export { darkGlassChartTheme }    from './themes/darkGlass';
export { midnightChartTheme }     from './themes/midnight';
export { neonCyberChartTheme }    from './themes/neonCyber';
export { enterpriseChartTheme }   from './themes/enterprise';
export { lightCanvasChartTheme }  from './themes/lightCanvas';
export { lightMinimalChartTheme } from './themes/lightMinimal';
// Polarity variants
export { darkGlassLightChartTheme }   from './themes/darkGlassLight';
export { midnightLightChartTheme }    from './themes/midnightLight';
export { neonCyberLightChartTheme }   from './themes/neonCyberLight';
export { enterpriseLightChartTheme }  from './themes/enterpriseLight';
export { lightCanvasDarkChartTheme }  from './themes/lightCanvasDark';
export { lightMinimalDarkChartTheme } from './themes/lightMinimalDark';
```

**Edit 2:** Add `ChartThemePair` type export to the existing type export block (currently lines 140–153). Find the line:
```typescript
export type { ChartThemeOverrides } from './themes/createChartTheme';
```
And change it to:
```typescript
export type { ChartThemeOverrides } from './themes/createChartTheme';
export type { ChartThemePair } from './themes/index';
```

**Edit 3:** Remove the standalone duplicate `CHART_THEME_PAIRS` export at the very end of the file (currently line 159):
```typescript
export {CHART_THEME_PAIRS} from './themes/index';
```
Delete this line. `CHART_THEME_PAIRS` is already exported at line 138 via `export { CHART_THEMES } from './themes/index';` — add `CHART_THEME_PAIRS` to that same statement instead:
```typescript
// Change line 138 from:
export { CHART_THEMES } from './themes/index';
// To:
export { CHART_THEMES, CHART_THEME_PAIRS } from './themes/index';
```

**Lines 155–157 (V1 deprecated type exports) are explicitly preserved — do not touch them:**
```typescript
// V1 deprecated type exports (migration compat)
/** @deprecated V1 type. Use BarChartDSL, LineChartDSL, etc. from specific imports. */
export type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from './elements/chart/types';
```
These backward-compatibility exports must remain. They are outside the theme section and are not part of this change.

---

---

## Stream D — `theme-gallery`

**Scope:** PM-2 Consensus Summary, Agreed Scope item 6: "Add at least one scene in `apps/examples/` demonstrating all 12 family × polarity variants side-by-side."

**Approach:** A static React page (no `SceneEngine` / `ScenePlayer`) that renders a 12-card grid — one card per `ThemeFamily × polarity`. Each card displays the key tokens visually: background color swatch, 8 series accent swatches, projection beam color, and tooltip sample. This verifies that the theme corrections (Stream A) produce cohesive, family-aligned output visible to reviewers without requiring a running 3D render.

**Files to create:**

### D.1 — `apps/examples/src/theme-gallery/ThemeSwatchCard.tsx`

A self-contained React component. Props:
```typescript
type ThemeSwatchCardProps = {
  /** Display label, e.g. "darkGlass / dark" */
  label: string;
  /** CSS color for the card background (from ChartTheme.background.planeColor) */
  backgroundColor: string;
  /** 8 accent hex colors (from ChartTheme.series[].color) */
  palette: readonly string[];
  /** Projection beam hex color (from ChartTheme.projection.color) */
  projectionColor: string;
  /** Tooltip border CSS color (from ChartTheme.tooltip.borderColor) */
  tooltipBorderColor: string;
  /** Primary text color for labels on the card */
  textColor: string;
};
```

Renders:
- Card wrapper: `backgroundColor` fill, 1px border using `tooltipBorderColor`
- Title: `label` in `textColor`, `12px` `system-ui`
- Palette row: 8 × 16×16px color swatches, left-to-right, from `palette`
- Projection indicator: a 4px-height horizontal bar in `projectionColor`, full card width
- No animations, no Three.js, no framer-motion — plain CSS via inline styles

```typescript
// apps/examples/src/theme-gallery/ThemeSwatchCard.tsx
import type { JSX } from 'react';

export type ThemeSwatchCardProps = {
  label: string;
  backgroundColor: string;
  palette: readonly string[];
  projectionColor: string;
  tooltipBorderColor: string;
  textColor: string;
};

export function ThemeSwatchCard({
  label, backgroundColor, palette, projectionColor, tooltipBorderColor, textColor,
}: ThemeSwatchCardProps): JSX.Element {
  return (
    <div style={{
      backgroundColor,
      border: `1px solid ${tooltipBorderColor}`,
      borderRadius: 6,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 200,
    }}>
      <div style={{ color: textColor, fontSize: 11, fontFamily: 'system-ui', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {palette.map((color, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 3,
            backgroundColor: color, flexShrink: 0,
          }} />
        ))}
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        backgroundColor: projectionColor,
        opacity: 0.85,
      }} />
    </div>
  );
}
```

### D.2 — `apps/examples/src/theme-gallery/ThemeGalleryPage.tsx`

The full page component. Imports `CHART_THEME_PAIRS` and `DIAGRAM_THEME_PAIRS` and renders a 2-column grid (dark polarity left, light polarity right) with a row per family.

```typescript
// apps/examples/src/theme-gallery/ThemeGalleryPage.tsx
import type { JSX } from 'react';
import { CHART_THEME_PAIRS } from '@brewsite/charts';
import { DIAGRAM_THEME_PAIRS } from '@brewsite/diagram';
import { ThemeSwatchCard } from './ThemeSwatchCard';
import type { ThemeFamily } from '@brewsite/core';

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

export default function ThemeGalleryPage(): JSX.Element {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', background: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Theme Family Gallery</h1>
      <p style={{ color: '#aaa', fontSize: 13, marginBottom: 24 }}>
        All 12 family × polarity variants. Dark polarity left, light polarity right.
        Projection bar = projection.color. Card border = tooltip.borderColor.
      </p>

      {/* Chart themes grid */}
      <h2 style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>@brewsite/charts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 520, marginBottom: 40 }}>
        {FAMILIES.map((family) => {
          const dark = CHART_THEME_PAIRS[family].dark;
          const light = CHART_THEME_PAIRS[family].light;
          return (
            <>
              <ThemeSwatchCard
                key={`${family}-dark`}
                label={`${family} / dark`}
                backgroundColor={dark.background.planeColor ?? '#111'}
                palette={dark.series.map(s => s.color)}
                projectionColor={dark.projection?.color ?? '#888'}
                tooltipBorderColor={dark.tooltip?.borderColor ?? '#444'}
                textColor={dark.axis.labelColor}
              />
              <ThemeSwatchCard
                key={`${family}-light`}
                label={`${family} / light`}
                backgroundColor={light.background.planeColor ?? '#fff'}
                palette={light.series.map(s => s.color)}
                projectionColor={light.projection?.color ?? '#888'}
                tooltipBorderColor={light.tooltip?.borderColor ?? '#ccc'}
                textColor={light.axis.labelColor}
              />
            </>
          );
        })}
      </div>

      {/* Diagram themes grid */}
      <h2 style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>@brewsite/diagram</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 520 }}>
        {FAMILIES.map((family) => {
          const dark = DIAGRAM_THEME_PAIRS[family].dark;
          const light = DIAGRAM_THEME_PAIRS[family].light;
          return (
            <>
              <ThemeSwatchCard
                key={`diag-${family}-dark`}
                label={`${family} / dark`}
                backgroundColor={dark.node.defaultColor}
                palette={dark.palette}
                projectionColor={dark.edge.defaultFlowColor}
                tooltipBorderColor={dark.edge.defaultColor}
                textColor={dark.node.defaultLabelColor}
              />
              <ThemeSwatchCard
                key={`diag-${family}-light`}
                label={`${family} / light`}
                backgroundColor={light.node.defaultColor}
                palette={light.palette}
                projectionColor={light.edge.defaultFlowColor}
                tooltipBorderColor={light.edge.defaultColor}
                textColor={light.node.defaultLabelColor}
              />
            </>
          );
        })}
      </div>
    </div>
  );
}
```

**Note on React key warnings:** The two `<ThemeSwatchCard>` siblings inside `.map()` must be wrapped in a `<React.Fragment key={family}>` to avoid React key warnings. The implementation above uses shorthand `<>` which does not support `key` — wrap with `<React.Fragment key={family}>` instead.

### D.3 — Register the route in `apps/examples/src/App.tsx`

**Add two lines to `App.tsx`:**

Add this lazy import at the top with the other lazy imports:
```typescript
const ThemeGalleryPage = lazy(() => import('./theme-gallery/ThemeGalleryPage'));
```

Add this route inside the `<Routes>` block:
```tsx
<Route path="/theme-gallery" element={<ThemeGalleryPage />} />
```

Add a list item to the index page `<ul>`:
```tsx
<li><a href="/examples/theme-gallery">Theme Family Gallery (all 12 variants)</a></li>
```

### D.4 — Verification

```bash
# Dev server: navigate to http://localhost:5173/examples/theme-gallery
# Visually verify:
# - 12 chart theme cards rendered in a 2-column grid (dark left, light right per family)
# - 12 diagram theme cards rendered below
# - midnight cards show amber palette and projection bars (not blue)
# - enterprise dark card has dark background (not white)
# - lightCanvas cards show blue projection bar (not green)
# - lightMinimal cards show blue-pastel projection bar (not gray)

pnpm --filter @brewsite/examples typecheck
```

---

## Test Strategy

### Existing Tests That Must Still Pass

After each stream, the following test suites must pass without modification:

| Test File | Stream | Why It Still Passes |
|---|---|---|
| `packages/charts/src/themes/__tests__/createChartTheme.test.ts` | A | No assertions check exact `borderColor`/`valueColor`/`projection.color` values. The "tooltip tokens present and valid" suite only checks type shape, not specific hex values. Series material assertions test `darkGlassChartTheme` (dark variant, unchanged). |
| `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts` | B | No diagram code changes. All assertions pass. |
| All chart renderer tests | A | No renderer behavior changes — only theme token values. |
| All diagram compiler/renderer tests | B, C | No implementation changes. |

### New Test Assertions (add to `packages/charts/src/themes/__tests__/createChartTheme.test.ts`)

Add a new `describe` block at the end of the file:

```typescript
describe('Stream A corrections: material and tooltip/projection token values', () => {
  // darkGlassLight material correction
  it('darkGlassLightChartTheme series[0].metalness is 0.10 (was 0.50)', () => {
    expect(darkGlassLightChartTheme.series[0]!.metalness).toBe(0.10);
  });

  it('darkGlassLightChartTheme series[0].roughness is 0.34 (was 0.14)', () => {
    expect(darkGlassLightChartTheme.series[0]!.roughness).toBe(0.34);
  });

  it('darkGlassLightChartTheme all series have metalness 0.10', () => {
    for (const s of darkGlassLightChartTheme.series) {
      expect(s.metalness).toBe(0.10);
    }
  });

  it('darkGlassLightChartTheme all series have roughness 0.34', () => {
    for (const s of darkGlassLightChartTheme.series) {
      expect(s.roughness).toBe(0.34);
    }
  });

  // midnight tooltip/projection correction (amber family, not blue)
  it('midnightChartTheme.projection.color is amber (#E2A33A), not blue', () => {
    expect(midnightChartTheme.projection!.color).toBe('#E2A33A');
  });

  it('midnightChartTheme.tooltip.borderColor contains amber family rgba values', () => {
    expect(midnightChartTheme.tooltip!.borderColor).toBe('rgba(226,163,58,0.30)');
  });

  it('midnightLightChartTheme.projection.color is amber (#A7793A), not blue', () => {
    expect(midnightLightChartTheme.projection!.color).toBe('#A7793A');
  });

  it('midnightLightChartTheme.tooltip.valueColor is warm (#3A2A1B), not blue', () => {
    expect(midnightLightChartTheme.tooltip!.valueColor).toBe('#3A2A1B');
  });

  // enterprise dark tooltip correction
  it('enterpriseChartTheme.tooltip.background is dark navy (not white)', () => {
    expect(enterpriseChartTheme.tooltip!.background).toBe('rgba(10,20,36,0.94)');
  });

  it('enterpriseChartTheme.tooltip.valueColor is light (#E3ECF8) for dark polarity', () => {
    expect(enterpriseChartTheme.tooltip!.valueColor).toBe('#E3ECF8');
  });

  it('enterpriseChartTheme.projection.opacity is 0.72', () => {
    expect(enterpriseChartTheme.projection!.opacity).toBe(0.72);
  });

  // lightCanvas tooltip/projection correction
  it('lightCanvasChartTheme.projection.color is blue (#3D63D9), not green', () => {
    expect(lightCanvasChartTheme.projection!.color).toBe('#3D63D9');
  });

  it('lightCanvasDarkChartTheme.projection.color is blue (#3D63D9), not green', () => {
    expect(lightCanvasDarkChartTheme.projection!.color).toBe('#3D63D9');
  });

  it('lightCanvasDarkChartTheme.tooltip.background is navy-tinted (not green-tinted)', () => {
    expect(lightCanvasDarkChartTheme.tooltip!.background).toBe('rgba(18,26,38,0.94)');
  });

  // lightMinimal tooltip/projection correction
  it('lightMinimalChartTheme.projection.color is pastel blue (#7FAEEA), not gray', () => {
    expect(lightMinimalChartTheme.projection!.color).toBe('#7FAEEA');
  });

  it('lightMinimalDarkChartTheme.projection.color is pastel blue (#7FAEEA), not gray', () => {
    expect(lightMinimalDarkChartTheme.projection!.color).toBe('#7FAEEA');
  });

  it('lightMinimalChartTheme.tooltip.valueColor is family-specific (#223248), not generic', () => {
    expect(lightMinimalChartTheme.tooltip!.valueColor).toBe('#223248');
  });

  it('lightMinimalDarkChartTheme.tooltip.valueColor is #E8EDF5', () => {
    expect(lightMinimalDarkChartTheme.tooltip!.valueColor).toBe('#E8EDF5');
  });

  // Regression: dark variants must not have white/light tooltip backgrounds
  it('No dark-polarity chart theme has a white tooltip background', () => {
    const darkThemes = [
      darkGlassChartTheme,
      midnightChartTheme,
      neonCyberChartTheme,
      enterpriseChartTheme,
      lightCanvasDarkChartTheme,
      lightMinimalDarkChartTheme,
    ];
    for (const theme of darkThemes) {
      expect(theme.tooltip!.background).not.toMatch(/rgba\(255,255,255/);
    }
  });

  // Regression: midnight must not have blue tooltip/projection
  it('midnightChartTheme.tooltip.borderColor does not contain blue channel values', () => {
    expect(midnightChartTheme.tooltip!.borderColor).not.toMatch(/107,155,255/);
    expect(midnightChartTheme.tooltip!.borderColor).not.toMatch(/79,100,200/);
  });

  // Challenge 3a: midnight light tooltip.borderColor amber assertion (PM-2 named this explicitly)
  it('midnightLightChartTheme.tooltip.borderColor is amber family, not blue', () => {
    expect(midnightLightChartTheme.tooltip!.borderColor).toBe('rgba(170,120,58,0.28)');
  });

  // Challenge 3b: cross-theme regression guard — no light-polarity theme should ever have
  // metalness > 0.20, which would produce dark mirror-like surfaces on light backgrounds.
  it('All light-polarity chart themes have series metalness ≤ 0.20 (regression guard)', () => {
    const lightThemes = [
      darkGlassLightChartTheme,
      midnightLightChartTheme,
      neonCyberLightChartTheme,
      enterpriseLightChartTheme,
      lightCanvasChartTheme,
      lightMinimalChartTheme,
    ];
    for (const theme of lightThemes) {
      for (const s of theme.series) {
        expect(s.metalness).toBeLessThanOrEqual(0.20);
      }
    }
  });
});
```

---

## Verification Commands

Run these commands to verify each stream is complete and correct:

### Stream A
```bash
# Run chart theme tests
pnpm --filter @brewsite/charts vitest run src/themes/__tests__/createChartTheme.test.ts

# Run all chart tests
pnpm --filter @brewsite/charts test

# Typecheck charts
pnpm --filter @brewsite/charts typecheck
```

### Stream B
```bash
# Run diagram theme tests (verify nothing regressed)
pnpm --filter @brewsite/diagram vitest run src/elements/diagram/__tests__/compile.test.ts

# Run all diagram tests
pnpm --filter @brewsite/diagram test
```

### Stream C
```bash
# Typecheck both packages to verify exports are type-correct
pnpm --filter @brewsite/charts typecheck
pnpm --filter @brewsite/diagram typecheck

# Full test suite — no new failures from export changes
pnpm test
```

### Full suite
```bash
pnpm build && pnpm test && pnpm typecheck
```

---

## File Change Summary

| Stream | File | Change Type |
|---|---|---|
| A | `packages/charts/src/themes/darkGlassLight.ts` | Series metalness/roughness correction |
| A | `packages/charts/src/themes/midnight.ts` | Tooltip + projection full replacement |
| A | `packages/charts/src/themes/midnightLight.ts` | Tooltip + projection full replacement |
| A | `packages/charts/src/themes/enterprise.ts` | Tooltip full replacement + projection.opacity |
| A | `packages/charts/src/themes/enterpriseLight.ts` | Tooltip 3-field correction |
| A | `packages/charts/src/themes/lightCanvas.ts` | Tooltip 3-field correction + projection.color |
| A | `packages/charts/src/themes/lightCanvasDark.ts` | Tooltip full replacement + projection.color + projection.emissiveIntensity |
| A | `packages/charts/src/themes/lightMinimal.ts` | Tooltip 3-field correction + projection.color + projection.opacity |
| A | `packages/charts/src/themes/lightMinimalDark.ts` | Tooltip 3-field correction + projection 4-field correction |
| A (test) | `packages/charts/src/themes/__tests__/createChartTheme.test.ts` | Add new describe block with 20 assertions |
| B | *(none)* | No changes — all values verified correct |
| C | `packages/diagram/src/index.ts` | Add 10 new theme exports + 2 registry exports + 1 type export |
| C | `packages/charts/src/index.ts` | Add 8 polarity variant exports + 1 type export + consolidate duplicates (3 surgical edits; V1 deprecated type exports on lines 155–157 must be preserved) |
| D | `apps/examples/src/theme-gallery/ThemeSwatchCard.tsx` | New file — reusable swatch card component |
| D | `apps/examples/src/theme-gallery/ThemeGalleryPage.tsx` | New file — 12-variant gallery page |
| D | `apps/examples/src/App.tsx` | Add lazy import + 1 Route + 1 nav link |

**Total: 11 source files + 1 test file + 3 example app files (2 new, 1 edited).**

---

## Implementation Notes for Developer

1. **Order of operations within Stream A:** There is no dependency between the 9 chart files. Edit them in any order. Each file is independent.

2. **`spread` pattern in light/dark variants:** Light variant files use `...darkVariantTheme` spread. When replacing `tooltip` and `projection` blocks, ensure the entire block is replaced — do not spread from the dark parent, as that would re-inherit the incorrect blue values.

3. **TypeScript `as const` not needed on tooltip/projection blocks:** These are already typed via `ChartTheme`. No `as const` needed.

4. **`lightCanvas.ts` is the LIGHT canonical variant.** Its name is `'lightCanvas'` (not `'lightCanvas-light'`). `lightCanvasDark.ts` exports `lightCanvasDarkChartTheme` with name `'lightCanvas-dark'`. Do not confuse the naming convention.

5. **`blur: ''` in `lightMinimal.ts` is intentional.** The spec specifies empty string = no `backdrop-filter`. Do not change this.

6. **Stream C export consolidation in charts:** Line 159 of `packages/charts/src/index.ts` has a standalone `export {CHART_THEME_PAIRS}` that was added separately. The new exports block consolidates it. Remove the standalone line to avoid a duplicate export TypeScript error.

7. **Stream C diagram export path:** The diagram root `src/index.ts` uses `'./elements/diagram/themes'` as the barrel path. All new exports should use this same barrel path — do not import directly from individual theme files.
