---
title: "Theme Family Art Direction - Cross-Package World-Class Spec"
doc_type: note
owner: design-system
status: proposed
updated: 2026-03-11
---

# Theme Family Art Direction - Cross-Package World-Class Spec

## 1. Purpose

Define an implementation-grade, world-class visual system for all six `ThemeFamily` values across:
- `@brewsite/core` (`SceneTheme`)
- `@brewsite/diagram` (`DiagramTheme`)
- `@brewsite/charts` (`ChartTheme`)
- inherited typography behavior in `@brewsite/model` labels and `@brewsite/slides` overlays

This is not a moodboard note. This is a token-level art direction spec that can be implemented directly.

## 2. Scope and Current Gaps

Canonical families:
- `darkGlass`
- `midnight`
- `neonCyber`
- `enterprise`
- `lightCanvas`
- `lightMinimal`

Current gaps this spec closes:
- Opposite polarity variants are still placeholders in core, diagram, and charts.
- Family typography is mostly generic (`system-ui`) and not differentiated.
- Several scene backgrounds are flat fills without depth overlays.
- Family motion/emissive behavior is inconsistent across diagram and charts.

## 3. Swatch Notation

All tables include both hex and a visual chip.

If your renderer supports inline HTML, chips display as color blocks. If not, use the hex value as source of truth.

Example format:
- `<span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5A6CFF"></span> #5A6CFF`

## 4. Global Quality Bar

A family is production-ready only when all are true:
- Both polarities are fully designed (no placeholder reuse).
- Diagram + chart feel like one brand voice in side-by-side composition.
- Primary text equivalents keep at least 4.5:1 contrast on scene background.
- Motion intensity matches family identity and does not reduce data readability.
- HTML overlay typography and WebGL typography are visually aligned.

## 5. Family Specifications

For all families, series colors and material defaults are defined in `5.x.2b Series Material Profile`. Chart tables in `5.x.5` reference those values instead of duplicating them.

## 5.1 darkGlass

Design intent:
- Premium obsidian control-room aesthetic.
- Smoked black glass with espresso/chocolate structure and oxblood depth.
- Ember-orange highlights with restrained deep-blue support (not blue-forward).

### 5.1.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#070504"></span> `#070504` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F8F3EF"></span> `#F8F3EF` | Base scene background |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#130B08"></span> `#130B08` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#EFE6DE"></span> `#EFE6DE` | Gradient secondary stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1E1412"></span> `#1E1412` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFF9F5"></span> `#FFF9F5` | Node/card primary surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5B3A33"></span> `#5B3A33` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#B89F92"></span> `#B89F92` | Borders, axes, guides |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F2E6DE"></span> `#F2E6DE` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#2B1F1A"></span> `#2B1F1A` | Primary labels/text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#B79B8F"></span> `#B79B8F` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#6E5750"></span> `#6E5750` | Secondary labels/text |

### 5.1.2 Accent Palette (Shared Diagram/Chart Order)

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#B33A2B"></span> | `#B33A2B` | Core category / primary series |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E36A2E"></span> | `#E36A2E` | Secondary series / flow |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#7A1F2D"></span> | `#7A1F2D` | Contrast category |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#2E4F7A"></span> | `#2E4F7A` | Deep blue counterpoint |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5A2C1D"></span> | `#5A2C1D` | Chocolate accent |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FF8A3D"></span> | `#FF8A3D` | High-visibility highlight |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8F3B4A"></span> | `#8F3B4A` | Tertiary data color |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1E3554"></span> | `#1E3554` | Auxiliary deep support |

### 5.1.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.18` | `0.10` |
| `series[].roughness` | `0.22` | `0.34` |
| `series[].transmission` | `0.14` | `0.02` |
| `series[].emissiveIntensity` | `0.34,0.40,0.30,0.20,0.22,0.44,0.24,0.18` | `0.04,0.05,0.03,0.02,0.02,0.06,0.02,0.01` |
| `series[].depth` | `0.24` | `0.18` |

### 5.1.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #070504 0%, #130B08 100%)` | `linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(227,106,46,0.14) 0%, rgba(122,31,45,0.10) 42%, rgba(0,0,0,0.30) 100%)` | `linear-gradient(180deg, rgba(227,106,46,0.08) 0%, rgba(255,255,255,0) 52%, rgba(110,87,80,0.10) 100%)` |
| `floor.grid.lineColor` | `#3A2924` | `#BFA99E` |
| `floor.grid.majorLineColor` | `#6B4338` | `#9A7569` |
| `font.htmlFamily` | `"Sora", "Inter", sans-serif` | `"Sora", "Inter", sans-serif` |

### 5.1.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#1E1412` | `#FFF9F5` |
| `node.defaultBoxColor` | `#2A1D1A` | `#F4EAE3` |
| `node.defaultLabelColor` | `#F2E6DE` | `#2B1F1A` |
| `edge.defaultColor` | `#B33A2B` | `#9F4637` |
| `edge.defaultFlowColor` | `#E36A2E` | `#C96A3F` |
| `group.defaultBorderColor` | `#6B4338` | `#B89F92` |
| `environment.envMapIntensity` | `0.78-0.92` | `0.14-0.24` |
| `node.glowIntensity` | `0.10` | `0.00` |
| `node.glowSpread` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.15` | `-0.15` |
| `node.borderColorLightenFactor` | `0.20` | `0.20` |
| `edge.defaultFlowSpeed` | `0.30` | `0.24` |
| `edge.flowPulseIntensity` | `0.68` | `0.58` |

### 5.1.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.1.2b` | `See 5.1.2b` |
| `axis.labelColor` | `#F0E4DA` | `#2B1F1A` |
| `legend.textColor` | `#F0E4DA` | `#2B1F1A` |
| `interaction.hoverColor` | `#FF8A3D` | `#E36A2E` |
| `referenceLines.defaultColor` | `#7A1F2D` | `#8F3B4A` |

#### Tooltip Tokens

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(28,16,10,0.92)` | `rgba(252,246,240,0.95)` |
| `tooltip.blur` | `8px` | `6px` |
| `tooltip.borderColor` | `rgba(227,106,46,0.30)` | `rgba(179,58,43,0.25)` |
| `tooltip.borderRadius` | `6px` | `6px` |
| `tooltip.valueColor` | `#F0E4DA` | `#3A1A10` |
| `tooltip.labelColor` | `rgba(240,228,218,0.65)` | `rgba(58,26,16,0.60)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 4px 16px rgba(0,0,0,0.50)` | `0 2px 10px rgba(0,0,0,0.12)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#E36A2E` | `#B33A2B` |
| `projection.emissiveIntensity` | `0.80` | `0.60` |
| `projection.beamWidth` | `0.004` | `0.004` |
| `projection.opacity` | `0.85` | `0.75` |
| `projection.dotRadius` | `0.022` | `0.022` |
| `projection.dotEmissiveIntensity` | `1.10` | `0.90` |
| `projection.animationDurationMs` | `220` | `220` |

## 5.2 midnight

Design intent:
- Warm cinematic seriousness.
- Bronze and amber authority.
- Deliberate, low-noise motion.

### 5.2.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#0D0907"></span> `#0D0907` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FAF6EE"></span> `#FAF6EE` | Base scene background |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1A120D"></span> `#1A120D` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F1E7D8"></span> `#F1E7D8` | Gradient secondary stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#261A13"></span> `#261A13` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFF9EE"></span> `#FFF9EE` | Node/card surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#6E553B"></span> `#6E553B` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#BFA681"></span> `#BFA681` | Borders and guides |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F2E7D4"></span> `#F2E7D4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#3A2A1B"></span> `#3A2A1B` | Primary text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#BCA180"></span> `#BCA180` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#7B664C"></span> `#7B664C` | Secondary text |

### 5.2.2 Accent Palette

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E2A33A"></span> | `#E2A33A` | Primary category |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#D0634B"></span> | `#D0634B` | Secondary category |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#C39B52"></span> | `#C39B52` | Warm neutral highlight |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#4F8D7B"></span> | `#4F8D7B` | Counterpoint cool accent |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A86A8F"></span> | `#A86A8F` | Distinct tertiary |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8B6A3D"></span> | `#8B6A3D` | Deep bronze |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#6B8446"></span> | `#6B8446` | Earth green |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#BE6B4A"></span> | `#BE6B4A` | Burnt clay |

### 5.2.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.08` | `0.06` |
| `series[].roughness` | `0.48` | `0.40` |
| `series[].transmission` | `0.00` | `0.00` |
| `series[].emissiveIntensity` | `0.28,0.24,0.22,0.20,0.18,0.16,0.14,0.12` | `0.03,0.03,0.02,0.02,0.02,0.02,0.01,0.01` |
| `series[].depth` | `0.22` | `0.18` |

### 5.2.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #0D0907 0%, #1A120D 100%)` | `linear-gradient(180deg, #FAF6EE 0%, #F1E7D8 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(226,163,58,0.12) 0%, rgba(0,0,0,0.28) 100%)` | `linear-gradient(180deg, rgba(195,155,82,0.10) 0%, rgba(255,255,255,0) 55%, rgba(139,106,61,0.12) 100%)` |
| `floor.grid.lineColor` | `#4B3A29` | `#B99D77` |
| `floor.grid.majorLineColor` | `#7D603C` | `#9F7D52` |
| `font.htmlFamily` | `"Manrope", "Source Sans 3", sans-serif` | `"Manrope", "Source Sans 3", sans-serif` |

### 5.2.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#261A13` | `#FFF9EE` |
| `node.defaultBoxColor` | `#332319` | `#F2E6D5` |
| `node.defaultLabelColor` | `#F2E7D4` | `#3A2A1B` |
| `edge.defaultColor` | `#E2A33A` | `#A7793A` |
| `edge.defaultFlowColor` | `#D0634B` | `#C07A59` |
| `group.defaultBorderColor` | `#7D603C` | `#B58C5A` |
| `environment.envMapIntensity` | `0.45-0.65` | `0.08-0.20` |
| `node.glowIntensity` | `0.00` | `0.00` |
| `node.glowSpread` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.15` | `-0.15` |
| `node.borderColorLightenFactor` | `0.20` | `0.20` |
| `edge.defaultFlowSpeed` | `0.24` | `0.20` |
| `edge.flowPulseIntensity` | `0.58` | `0.46` |

### 5.2.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.2.2b` | `See 5.2.2b` |
| `axis.labelColor` | `#F0E4CF` | `#4A3723` |
| `legend.textColor` | `#F0E4CF` | `#4A3723` |
| `interaction.hoverColor` | `#E2A33A` | `#A7793A` |
| `referenceLines.defaultColor` | `#D0634B` | `#8B6A3D` |

#### Tooltip Tokens

> **Note:** Current code values for midnight tooltip/projection are incorrect (blue colors on a warm amber family — copy-paste error). The values below are the authoritative corrected spec.

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(13,9,7,0.94)` | `rgba(250,246,238,0.96)` |
| `tooltip.blur` | `8px` | `6px` |
| `tooltip.borderColor` | `rgba(226,163,58,0.30)` | `rgba(170,120,58,0.28)` |
| `tooltip.borderRadius` | `6px` | `6px` |
| `tooltip.valueColor` | `#F0E4CF` | `#3A2A1B` |
| `tooltip.labelColor` | `rgba(240,228,207,0.65)` | `rgba(58,42,27,0.58)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 4px 16px rgba(0,0,0,0.55)` | `0 2px 10px rgba(0,0,0,0.10)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

> **Note:** Same correction applies — replace blue beam values with amber-family values.

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#E2A33A` | `#A7793A` |
| `projection.emissiveIntensity` | `0.85` | `0.55` |
| `projection.beamWidth` | `0.004` | `0.004` |
| `projection.opacity` | `0.88` | `0.75` |
| `projection.dotRadius` | `0.022` | `0.020` |
| `projection.dotEmissiveIntensity` | `1.10` | `0.85` |
| `projection.animationDurationMs` | `220` | `220` |

## 5.3 neonCyber

Design intent:
- Electric signal intelligence.
- Violet/cyan pulse language.
- High energy with strict hierarchy.

### 5.3.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#02030D"></span> `#02030D` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F5F8FF"></span> `#F5F8FF` | Base scene background |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#09122A"></span> `#09122A` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#EAF2FF"></span> `#EAF2FF` | Secondary stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#0C183A"></span> `#0C183A` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F8FBFF"></span> `#F8FBFF` | Node/card surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5B4BB5"></span> `#5B4BB5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#91A5DB"></span> `#91A5DB` | Borders/axes/guides |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#D8CCFF"></span> `#D8CCFF` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1E2F5A"></span> `#1E2F5A` | Primary text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#9688D6"></span> `#9688D6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#516498"></span> `#516498` | Secondary text |

### 5.3.2 Accent Palette

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8A3DFF"></span> | `#8A3DFF` | Primary series and rails |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#00E7FF"></span> | `#00E7FF` | Pulse/flow highlight |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#C260FF"></span> | `#C260FF` | Secondary series |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#11C9E8"></span> | `#11C9E8` | Cool support accent |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5B2CE6"></span> | `#5B2CE6` | Deep violet layer |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5EE8FF"></span> | `#5EE8FF` | High-contrast highlight |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A96BFF"></span> | `#A96BFF` | Auxiliary category |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1AAFD1"></span> | `#1AAFD1` | Deep cyan support |

### 5.3.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.12` | `0.10` |
| `series[].roughness` | `0.08` | `0.20` |
| `series[].transmission` | `0.00` | `0.00` |
| `series[].emissiveIntensity` | `0.95,0.88,0.82,0.76,0.71,0.66,0.62,0.58` | `0.08,0.07,0.06,0.05,0.05,0.04,0.04,0.03` |
| `series[].depth` | `0.22` | `0.18` |

### 5.3.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #02030D 0%, #09122A 100%)` | `linear-gradient(180deg, #F5F8FF 0%, #EAF2FF 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(138,61,255,0.16) 0%, rgba(0,231,255,0.08) 38%, rgba(0,0,0,0.28) 100%)` | `linear-gradient(180deg, rgba(138,61,255,0.08) 0%, rgba(0,231,255,0.06) 36%, rgba(30,47,90,0.08) 100%)` |
| `floor.grid.lineColor` | `#2D2D66` | `#A8B7E6` |
| `floor.grid.majorLineColor` | `#6E55D1` | `#8097D5` |
| `font.htmlFamily` | `"Space Grotesk", "Rajdhani", sans-serif` | `"Space Grotesk", "Rajdhani", sans-serif` |

### 5.3.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#0C183A` | `#F8FBFF` |
| `node.defaultBoxColor` | `#10224C` | `#EAF2FF` |
| `node.defaultLabelColor` | `#D8CCFF` | `#1E2F5A` |
| `edge.defaultColor` | `#8A3DFF` | `#6C54BF` |
| `edge.defaultFlowColor` | `#00E7FF` | `#11C9E8` |
| `group.defaultBorderColor` | `#8A3DFF` | `#8EA0D8` |
| `environment.envMapIntensity` | `0.55-0.80` | `0.12-0.26` |
| `node.glowIntensity` | `0.52` | `0.06` |
| `node.glowSpread` | `2.8` | `2.8` |
| `node.sideColorDarkenFactor` | `-0.15` | `-0.15` |
| `node.borderColorLightenFactor` | `0.25` | `0.25` |
| `edge.defaultFlowSpeed` | `0.82` | `0.65` |
| `edge.flowPulseIntensity` | `1.00` | `0.86` |

### 5.3.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.3.2b` | `See 5.3.2b` |
| `axis.labelColor` | `#D8CCFF` | `#2A3E70` |
| `legend.textColor` | `#D8CCFF` | `#2A3E70` |
| `interaction.hoverColor` | `#00E7FF` | `#11C9E8` |
| `referenceLines.defaultColor` | `#8A3DFF` | `#6C54BF` |

#### Tooltip Tokens

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(8,0,28,0.94)` | `rgba(240,248,255,0.95)` |
| `tooltip.blur` | `10px` | `6px` |
| `tooltip.borderColor` | `rgba(0,231,255,0.40)` | `rgba(138,61,255,0.30)` |
| `tooltip.borderRadius` | `4px` | `4px` |
| `tooltip.valueColor` | `#00E7FF` | `#3A0090` |
| `tooltip.labelColor` | `rgba(216,204,255,0.65)` | `rgba(58,0,144,0.55)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 0 16px rgba(0,231,255,0.20)` | `0 2px 10px rgba(138,61,255,0.15)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#00E7FF` | `#8A3DFF` |
| `projection.emissiveIntensity` | `1.20` | `0.70` |
| `projection.beamWidth` | `0.005` | `0.005` |
| `projection.opacity` | `0.90` | `0.80` |
| `projection.dotRadius` | `0.024` | `0.024` |
| `projection.dotEmissiveIntensity` | `1.40` | `1.00` |
| `projection.animationDurationMs` | `220` | `220` |

## 5.4 enterprise

Design intent:
- Board-ready, strategic, credible.
- Low-flair, high-confidence, high-legibility system maps.

### 5.4.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#0A1424"></span> `#0A1424` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F3F6FA"></span> `#F3F6FA` | Scene base |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#15253A"></span> `#15253A` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E7EDF5"></span> `#E7EDF5` | Gradient stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1E324F"></span> `#1E324F` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFFFFF"></span> `#FFFFFF` | Card/node surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#4A6386"></span> `#4A6386` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8BA0BA"></span> `#8BA0BA` | Guides and borders |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E5EEFA"></span> `#E5EEFA` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1F334E"></span> `#1F334E` | Primary text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A8B8CF"></span> `#A8B8CF` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5A6D86"></span> `#5A6D86` | Secondary text |

### 5.4.2 Accent Palette

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#4F76B8"></span> | `#4F76B8` | Primary series |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#3F7F73"></span> | `#3F7F73` | Secondary series |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#C9843F"></span> | `#C9843F` | Attention category |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#6D5D8E"></span> | `#6D5D8E` | Tertiary category |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#3B7E8D"></span> | `#3B7E8D` | Cool support |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8A6C47"></span> | `#8A6C47` | Neutralized warm |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5A724E"></span> | `#5A724E` | Supporting green |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#8B4A54"></span> | `#8B4A54` | Support accent |

### 5.4.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.04` | `0.03` |
| `series[].roughness` | `0.62` | `0.56` |
| `series[].transmission` | `0.00` | `0.00` |
| `series[].emissiveIntensity` | `0.04,0.04,0.04,0.04,0.04,0.03,0.03,0.03` | `0.01,0.01,0.01,0.01,0.01,0.01,0.00,0.00` |
| `series[].depth` | `0.26` | `0.20` |

### 5.4.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #0A1424 0%, #15253A 100%)` | `linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(79,118,184,0.10) 0%, rgba(0,0,0,0.22) 100%)` | `linear-gradient(180deg, rgba(79,118,184,0.06) 0%, rgba(31,51,78,0.08) 100%)` |
| `floor.grid.lineColor` | `#354A67` | `#A0B1C6` |
| `floor.grid.majorLineColor` | `#516C93` | `#7F95B2` |
| `font.htmlFamily` | `"IBM Plex Sans", "Inter", sans-serif` | `"IBM Plex Sans", "Inter", sans-serif` |

### 5.4.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#1E324F` | `#FFFFFF` |
| `node.defaultBoxColor` | `#274262` | `#E8EEF6` |
| `node.defaultLabelColor` | `#E5EEFA` | `#1F334E` |
| `edge.defaultColor` | `#4F76B8` | `#5E7EA9` |
| `edge.defaultFlowColor` | `#3B7E8D` | `#5A8A92` |
| `group.defaultBorderColor` | `#4A6386` | `#8BA0BA` |
| `environment.envMapIntensity` | `0.45-0.65` | `0.06-0.16` |
| `node.glowIntensity` | `0.00` | `0.00` |
| `node.glowSpread` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.15` | `-0.15` |
| `node.borderColorLightenFactor` | `0.25` | `0.25` |
| `edge.defaultFlowSpeed` | `0.08` | `0.04` |
| `edge.flowPulseIntensity` | `0.28` | `0.22` |

### 5.4.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.4.2b` | `See 5.4.2b` |
| `axis.labelColor` | `#E3ECF8` | `#2A405F` |
| `legend.textColor` | `#E3ECF8` | `#2A405F` |
| `interaction.hoverColor` | `#4F76B8` | `#5E7EA9` |
| `referenceLines.defaultColor` | `#6D5D8E` | `#5E6E8E` |

#### Tooltip Tokens

> **Note:** Current code dark tooltip uses a white background (`rgba(255,255,255,0.96)`) on a dark-background chart — inconsistent with the established pattern. The corrected spec below uses a dark navy background for the dark variant.

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(10,20,36,0.94)` | `rgba(255,255,255,0.97)` |
| `tooltip.blur` | `4px` | `4px` |
| `tooltip.borderColor` | `rgba(79,118,184,0.28)` | `rgba(79,118,184,0.22)` |
| `tooltip.borderRadius` | `6px` | `6px` |
| `tooltip.valueColor` | `#E3ECF8` | `#1A2A4A` |
| `tooltip.labelColor` | `rgba(227,236,248,0.58)` | `rgba(26,42,74,0.55)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 4px 14px rgba(0,0,0,0.45)` | `0 2px 8px rgba(0,0,0,0.08)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#4F76B8` | `#3F7F73` |
| `projection.emissiveIntensity` | `0.50` | `0.50` |
| `projection.beamWidth` | `0.003` | `0.003` |
| `projection.opacity` | `0.72` | `0.70` |
| `projection.dotRadius` | `0.018` | `0.018` |
| `projection.dotEmissiveIntensity` | `0.80` | `0.80` |
| `projection.animationDurationMs` | `220` | `220` |

## 5.5 lightCanvas

Design intent:
- Premium editorial light mode.
- Ceramic physicality and soft highlights.
- Rich but controlled jewel accents.

### 5.5.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#131923"></span> `#131923` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFFFFF"></span> `#FFFFFF` | Scene base |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1C2533"></span> `#1C2533` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F1F4F8"></span> `#F1F4F8` | Secondary stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#232F40"></span> `#232F40` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFFFFF"></span> `#FFFFFF` | Card/node surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#566A86"></span> `#566A86` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#AAB7CA"></span> `#AAB7CA` | Guides and structure |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E8EEF7"></span> `#E8EEF7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1D2A3D"></span> `#1D2A3D` | Primary text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A8B4C4"></span> `#A8B4C4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#5F7088"></span> `#5F7088` | Secondary text |

### 5.5.2 Accent Palette

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#3D63D9"></span> | `#3D63D9` | Primary series |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1E9A6F"></span> | `#1E9A6F` | Secondary series |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#D64566"></span> | `#D64566` | Alert/contrast |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#D2911F"></span> | `#D2911F` | Warm highlight |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#7357C7"></span> | `#7357C7` | Tertiary category |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#1D93AE"></span> | `#1D93AE` | Cool support |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A06D2F"></span> | `#A06D2F` | Earth support |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#4E8F3A"></span> | `#4E8F3A` | Green support |

### 5.5.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.18` | `0.20` |
| `series[].roughness` | `0.34` | `0.32` |
| `series[].transmission` | `0.00` | `0.00` |
| `series[].emissiveIntensity` | `0.06,0.05,0.05,0.04,0.04,0.03,0.03,0.02` | `0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00` |
| `series[].depth` | `0.20` | `0.18` |

### 5.5.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #131923 0%, #1C2533 100%)` | `linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(61,99,217,0.08) 0%, rgba(0,0,0,0.22) 100%)` | `linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(29,42,61,0.06) 100%)` |
| `floor.grid.lineColor` | `#41516A` | `#C4CCD8` |
| `floor.grid.majorLineColor` | `#5D7194` | `#9CAEC4` |
| `font.htmlFamily` | `"Plus Jakarta Sans", "Inter", sans-serif` | `"Plus Jakarta Sans", "Inter", sans-serif` |

### 5.5.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#232F40` | `#FFFFFF` |
| `node.defaultBoxColor` | `#2E3C4F` | `#F1F4F8` |
| `node.defaultLabelColor` | `#E8EEF7` | `#1D2A3D` |
| `edge.defaultColor` | `#3D63D9` | `#4768C9` |
| `edge.defaultFlowColor` | `#1D93AE` | `#2B8EA3` |
| `group.defaultBorderColor` | `#566A86` | `#AAB7CA` |
| `environment.envMapIntensity` | `0.25-0.45` | `0.00-0.08` |
| `node.glowIntensity` | `0.00` | `0.00` |
| `node.glowSpread` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.08` | `-0.08` |
| `node.borderColorLightenFactor` | `0.15` | `0.15` |
| `edge.defaultFlowSpeed` | `0.24` | `0.22` |
| `edge.flowPulseIntensity` | `0.30` | `0.26` |

### 5.5.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.5.2b` | `See 5.5.2b` |
| `axis.labelColor` | `#E8EEF7` | `#1F2D41` |
| `legend.textColor` | `#E8EEF7` | `#1F2D41` |
| `interaction.hoverColor` | `#3D63D9` | `#4768C9` |
| `referenceLines.defaultColor` | `#7357C7` | `#5F62AE` |

#### Tooltip Tokens

> **Note:** Current code uses a green-tinted tooltip background (`rgba(18,26,20,...)` dark, `rgba(90,138,106,...)` border) inconsistent with lightCanvas's primary blue accent (`#3D63D9`). Corrected to blue-family alignment.

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(18,26,38,0.94)` | `rgba(255,255,255,0.96)` |
| `tooltip.blur` | `8px` | `4px` |
| `tooltip.borderColor` | `rgba(61,99,217,0.28)` | `rgba(61,99,217,0.22)` |
| `tooltip.borderRadius` | `6px` | `6px` |
| `tooltip.valueColor` | `#E8EEF7` | `#1A2A4A` |
| `tooltip.labelColor` | `rgba(232,238,247,0.62)` | `rgba(26,42,74,0.55)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 4px 16px rgba(0,0,0,0.40)` | `0 2px 8px rgba(0,0,0,0.08)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#3D63D9` | `#3D63D9` |
| `projection.emissiveIntensity` | `0.70` | `0.50` |
| `projection.beamWidth` | `0.003` | `0.003` |
| `projection.opacity` | `0.80` | `0.70` |
| `projection.dotRadius` | `0.018` | `0.018` |
| `projection.dotEmissiveIntensity` | `1.00` | `0.80` |
| `projection.animationDurationMs` | `220` | `220` |

## 5.6 lightMinimal

Design intent:
- Documentation-first clarity.
- Minimal ornament, maximal information hierarchy.
- Calm pastels used strictly as categorical aid.

### 5.6.1 Neutral Swatches

| Token | Dark Variant | Light Variant | Usage |
|---|---|---|---|
| `bg-900` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#101317"></span> `#101317` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#FFFFFF"></span> `#FFFFFF` | Scene base |
| `bg-800` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#191E24"></span> `#191E24` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F7F9FC"></span> `#F7F9FC` | Secondary stop |
| `surface-600` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#252C35"></span> `#252C35` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F3F6FB"></span> `#F3F6FB` | Card/node surface |
| `wire-400` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#54606E"></span> `#54606E` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#BFC9D7"></span> `#BFC9D7` | Guides and borders |
| `text-100` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#E8EDF5"></span> `#E8EDF5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#223248"></span> `#223248` | Primary text |
| `text-300` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#A8B2C2"></span> `#A8B2C2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#6E7D92"></span> `#6E7D92` | Secondary text |

### 5.6.2 Accent Palette

| Accent | Swatch | Hex | Primary Use |
|---|---|---|---|
| `a1` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#7FAEEA"></span> | `#7FAEEA` | Primary category |
| `a2` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#AFA0EA"></span> | `#AFA0EA` | Secondary category |
| `a3` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#7FD8A2"></span> | `#7FD8A2` | Positive/support category |
| `a4` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#EAA0A0"></span> | `#EAA0A0` | Contrast category |
| `a5` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#EAD98E"></span> | `#EAD98E` | Warm support |
| `a6` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#78D5E3"></span> | `#78D5E3` | Cool support |
| `a7` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#B9E38C"></span> | `#B9E38C` | Secondary support |
| `a8` | <span style="display:inline-block;width:14px;height:14px;border:1px solid #666;background:#F0C8A2"></span> | `#F0C8A2` | Neutral warm support |

### 5.6.2b Series Material Profile

| Token | Dark | Light |
|---|---|---|
| `series[0..7].color` | `a1..a8` | `a1..a8` |
| `series[].metalness` | `0.02` | `0.00` |
| `series[].roughness` | `0.76` | `0.80` |
| `series[].transmission` | `0.00` | `0.00` |
| `series[].emissiveIntensity` | `0.03,0.03,0.02,0.02,0.02,0.01,0.01,0.01` | `0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00` |
| `series[].depth` | `0.16` | `0.16` |

### 5.6.3 SceneTheme Targets

| Token Surface | Dark Target | Light Target |
|---|---|---|
| `background.fill` | `linear-gradient(180deg, #101317 0%, #191E24 100%)` | `linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)` |
| `background.effects.overlayGradient` | `linear-gradient(180deg, rgba(127,174,234,0.05) 0%, rgba(0,0,0,0.20) 100%)` | `linear-gradient(180deg, rgba(34,50,72,0.00) 0%, rgba(34,50,72,0.04) 100%)` |
| `floor.grid.lineColor` | `#4A5563` | `#CAD2DF` |
| `floor.grid.majorLineColor` | `#647488` | `#AAB8CB` |
| `font.htmlFamily` | `"Inter", "Source Sans 3", sans-serif` | `"Inter", "Source Sans 3", sans-serif` |

### 5.6.4 DiagramTheme Targets

| Token | Dark | Light |
|---|---|---|
| `node.defaultColor` | `#252C35` | `#F3F6FB` |
| `node.defaultBoxColor` | `#2F3945` | `#E7EDF6` |
| `node.defaultLabelColor` | `#E8EDF5` | `#223248` |
| `edge.defaultColor` | `#7FAEEA` | `#6A94CD` |
| `edge.defaultFlowColor` | `#78D5E3` | `#67B9C8` |
| `group.defaultBorderColor` | `#54606E` | `#BFC9D7` |
| `environment.envMapIntensity` | `0.05-0.15` | `0.00` |
| `node.glowIntensity` | `0.00` | `0.00` |
| `node.glowSpread` | `2.2` | `2.2` |
| `node.sideColorDarkenFactor` | `-0.10` | `-0.10` |
| `node.borderColorLightenFactor` | `0.20` | `0.20` |
| `edge.defaultFlowSpeed` | `0.12` | `0.06` |
| `edge.flowPulseIntensity` | `0.18` | `0.16` |

### 5.6.5 ChartTheme Targets

| Token | Dark | Light |
|---|---|---|
| `series.materialProfile` | `See 5.6.2b` | `See 5.6.2b` |
| `axis.labelColor` | `#DEE5F0` | `#2A3A50` |
| `legend.textColor` | `#DEE5F0` | `#2A3A50` |
| `interaction.hoverColor` | `#7FAEEA` | `#6A94CD` |
| `referenceLines.defaultColor` | `#AFA0EA` | `#8C82CA` |

#### Tooltip Tokens

| Token | Dark | Light |
|---|---|---|
| `tooltip.background` | `rgba(16,16,18,0.94)` | `rgba(255,255,255,0.97)` |
| `tooltip.blur` | `6px` | `` |
| `tooltip.borderColor` | `rgba(127,174,234,0.20)` | `rgba(127,174,234,0.22)` |
| `tooltip.borderRadius` | `4px` | `4px` |
| `tooltip.valueColor` | `#E8EDF5` | `#223248` |
| `tooltip.labelColor` | `rgba(232,237,245,0.55)` | `rgba(34,50,72,0.50)` |
| `tooltip.fontSize` | `12` | `12` |
| `tooltip.shadow` | `0 4px 16px rgba(0,0,0,0.40)` | `0 1px 6px rgba(0,0,0,0.08)` |
| `tooltip.padding` | `8px 12px` | `8px 12px` |
| `tooltip.maxWidth` | `220` | `220` |
| `tooltip.offsetX` | `12` | `12` |
| `tooltip.offsetY` | `-12` | `-12` |

#### Projection Tokens

| Token | Dark | Light |
|---|---|---|
| `projection.color` | `#7FAEEA` | `#7FAEEA` |
| `projection.emissiveIntensity` | `0.40` | `0.30` |
| `projection.beamWidth` | `0.003` | `0.003` |
| `projection.opacity` | `0.62` | `0.55` |
| `projection.dotRadius` | `0.016` | `0.016` |
| `projection.dotEmissiveIntensity` | `0.65` | `0.50` |
| `projection.animationDurationMs` | `220` | `220` |

## 6. Typography and Font Asset Plan

Family typography mapping:
- `darkGlass`: `"Sora", "Inter", sans-serif`
- `midnight`: `"Manrope", "Source Sans 3", sans-serif`
- `neonCyber`: `"Space Grotesk", "Rajdhani", sans-serif`
- `enterprise`: `"IBM Plex Sans", "Inter", sans-serif`
- `lightCanvas`: `"Plus Jakarta Sans", "Inter", sans-serif`
- `lightMinimal`: `"Inter", "Source Sans 3", sans-serif`

WebGL typography alignment:
- Provide MSDF `webglFontUrl` per family to prevent HTML/WebGL drift.
- Keep semantic sizing constrained to:
  - `heading`: `1.45-1.60`
  - `body`: `1.0`
  - `label`: `0.82-0.92`
  - `caption`: `0.68-0.78`
  - `annotation`: `0.58-0.66`

## 7. Motion and Interaction Profiles

| Family | Flow Speed | Pulse Intensity | Hover Behavior | Style Intent |
|---|---:|---:|---|---|
| `darkGlass` | `0.22-0.36` | `0.58-0.78` | Warm ember bloom | Premium technical confidence |
| `midnight` | `0.16-0.30` | `0.45-0.70` | Warm edge lift | Deliberate executive narrative |
| `neonCyber` | `0.60-0.95` | `0.85-1.20` | Sharp electric pop | High-energy signal network |
| `enterprise` | `0.00-0.12` | `0.20-0.35` | Subtle tint shift | Boardroom clarity |
| `lightCanvas` | `0.18-0.32` | `0.20-0.40` | Soft chroma lift | Premium editorial polish |
| `lightMinimal` | `0.00-0.18` | `0.10-0.25` | Minimal state cue | Documentation readability |

## 8. Implementation Mapping by Package

Core (`packages/core/src/theme/presets.ts`):
- Upgrade every family pair to real token sets (remove placeholders).
- Move premium families to gradient backgrounds + overlays.
- Tune floor grid per family; avoid generic line colors.

Diagram (`packages/diagram/src/elements/diagram/themes/*.ts`):
- Keep palette order exactly equal to chart order.
- Implement opposite polarity variants as true family variants.
- Match motion profile ranges to section 7.

Charts (`packages/charts/src/themes/*.ts`):
- Apply shared `a1..a8` palette exactly.
- Use family-specific series material profile from section 5 (`metalness`, `roughness`, `transmission`, `emissiveIntensity`, `depth`).
- Align axis/legend/reference label colors to neutral text tokens.

Model (`packages/model`):
- Validate inherited overlay fonts and contrast for all families.

Slides (`packages/slides`):
- Add `ThemeFamily -> DeckTheme` mapper to keep deck + 3D scenes in one brand system.

## 9. Rollout Sequence

1. Implement all six opposite-polarity variants in core/diagram/charts.
2. Apply swatch tables as source values in theme files.
3. Add family-level typography assets (`webglFontUrl` per family).
4. Tune motion and interaction to section 7 ranges.
5. Publish a visual showcase with all 12 variants and fixed-camera snapshots.

## 10. Done Criteria

- No theme file marked placeholder in any package.
- Each family has one coherent look across scene, diagram, and chart.
- Swatch and series material values in code match this document exactly.
- Example gallery confirms consistency on desktop and mobile.

---

## PM-1 Review

**Reviewer:** brewsite-product-manager
**Date:** 2026-03-12
**Status:** Findings require note revision and scope clarification before plan authoring.

---

### 1. Scope Assessment

**Core is already done — the note's gap statement is incorrect.**

The note opens section 2 by listing "opposite polarity variants are still placeholders in core" as a current gap. This is **false**. `packages/core/src/theme/presets.ts` contains all 12 `SceneTheme` presets (6 families × 2 polarities) with production-quality values that match this note's token specs. `SCENE_THEME_PAIRS` is fully populated. The `@internal` markers referenced in the PRDs apply to the **diagram and chart** polarity variants — not core.

Similarly, **slides is already done.** Section 8 says "Add `ThemeFamily → DeckTheme` mapper to slides" as work to be done. `packages/slides/src/themeFamily.ts` contains a complete `DECK_THEME_PAIRS` implementation — `getDeckThemeForFamily()` and `createDeckThemeForFamily()` are exported from `packages/slides/src/index.ts`. The note is describing delivered work as future work.

**Actual remaining scope:**
- Chart polarity variant aesthetics: all 12 chart theme files exist but series material values diverge significantly from the note's spec (see Finding 6).
- Diagram polarity variants: all 6 light/dark variant files exist; real question is whether values are production quality vs. inherited placeholders.
- `webglFontUrl` per family: zero of 12 SceneTheme presets have a `webglFontUrl` (all `font.webglFontUrl` fields are absent). Section 6 and rollout step 3 call for per-family MSDF font URLs — this is genuinely unfinished.
- Motion tuning: `DiagramTheme.edge.defaultFlowSpeed`, `flowPulseIntensity`, and `ChartTheme.series.emissiveIntensity` per family — section 7 gives ranges but the note does not give implementation-grade per-family exact values, leaving too much implementation latitude.

**Scope creep items that should be removed or deferred:**
- Section 8's bullet on slides (`ThemeFamily → DeckTheme` mapper) should be removed from this note's scope. It's shipped. If values need updating, that's a maintenance task, not this feature.
- Section 6's "Provide MSDF `webglFontUrl` per family" is a **deployment and CDN problem**, not a theme API problem. It cannot ship as part of toolkit package updates — it requires font files to be hosted somewhere. This needs its own planning note.

**Missing scope:**
- The note covers `tooltip` and `projection` token blocks in `ChartTheme` nowhere. These are full CSS-level token objects (`ChartTooltipTokens`, `ChartProjectionTokens`) with per-family art direction in the implemented chart theme files. If this note is the source-of-truth art direction spec, it must cover these token groups.
- `DiagramThemeNodeConfig.glowSpread`, `glowIntensity`, `sideColorDarkenFactor`, `borderColorLightenFactor` — family-specific values for these material shaping tokens are not in the note. They are already set per-family in the diagram code, but without a note-level spec they can't be validated.

---

### 2. Conflicts and Redundancy vs. Existing PRDs

No outright conflicts. The three theming PRDs (`core`, `diagram`, `charts`) all explicitly track the production-quality polarity variant work as a "Follow-on (not yet shipped)" item. This note is the correct place to author the art direction that closes those follow-on items.

One redundancy worth flagging: the note's section 5.x.3 "SceneTheme Targets" (`background.fill`, `background.effects.overlayGradient`, `floor.grid.lineColor`, etc.) documents values that are **already live in `presets.ts`**. When the note says "here is what the token should be," readers don't know if this is describing existing code or prescribing future code. Since core is done, these tables are documentation of shipped values, not targets. The note should clearly distinguish "already implemented" from "needs to be implemented."

The core PRD section 7.4 hardcodes `--brewsite-text-primary: #ffffff` (dark) and `#111111` (light) as the CSS variable values — generic fallbacks that don't honor per-family `text-100` tokens. The note specifies family-specific `text-100` hex values in every neutral swatch table, but the CSS injection layer doesn't use them. Per-family text color theming for HTML overlays must go through `.bw-theme-{family}` CSS class overrides — they can't be consumed from the `SceneTheme` object directly. The note doesn't acknowledge this limitation or tell implementers how to handle it.

---

### 3. Open Questions — Opposite-Polarity Variant Strategy

**The "no placeholder reuse" quality bar in section 4 is being applied inconsistently.**

Looking at how the polarity variants are authored across the codebase:
- **Core** (`presets.ts`): Each of the 12 SceneTheme presets is independently specified. No spread+override approach. All values are unique to each polarity. This meets the "no placeholder reuse" bar.
- **Diagram** (`darkGlassLight.ts`): Spread from dark parent + selective override of `node.defaultColor`, `defaultBoxColor`, `defaultLabelColor`, `defaultMetalness`, edge colors, group colors, and environment. A structural spread is used, but the semantic values are genuinely different. This is the correct approach — spreading is fine; what matters is the visual output.
- **Charts** (`darkGlassLight.ts`): Same pattern — spread from dark parent + override series materials and axis/legend colors.

The quality question is whether the override values are production-quality art direction or quick light-mode inversions. Based on code review, the diagram light variants look considered (they don't just lighten the background; they also reduce metalness, drop glow, and shift emissive down substantially). The chart variants follow a similar pattern.

**Open question that needs an answer before planning:**
Is the architect's job to accept these values as final and write a plan that documents them as approved, or is this note intended to override them? The note's token tables and the code values **do not match** in several places (see Finding 6). If the note is authoritative, the architect must plan code changes to align to the note. If the code is authoritative, the note should be updated to match the code. This must be resolved before a plan is written.

---

### 4. Rollout Sequence (Section 9) — Soundness Assessment

**The sequence has structural problems.**

Step 1 ("Implement all six opposite-polarity variants in core/diagram/charts") is partially complete:
- Core: done.
- Diagram: structurally present but aesthetic quality needs verification against section 4's bar.
- Charts: structurally present but values diverge from note spec.

The sequence doesn't distinguish "already done" from "still to do" — a planning-grade document must.

Step 3 ("Add family-level typography assets `webglFontUrl` per family") is blocked on asset hosting. No MSDF font files are referenced anywhere in the codebase. Hosting MSDF files requires a CDN decision, font license review, and a build pipeline step. This is a prerequisite that should be a separate tracked item, not step 3 of this rollout. I recommend removing it from this feature's rollout or making it explicitly optional with a note that `webglFontUrl` remains `undefined` until font hosting is resolved.

Step 5 ("Publish a visual showcase with all 12 variants and fixed-camera snapshots") is a quality-verification step, not a toolkit-release criterion. This belongs in the launch criteria of each package's PRD, not as a rollout step. The example app in `apps/examples/` is the right vehicle for this; it doesn't need to be a separate step.

**Missing step**: Promote polarity variants from `@internal` to public named exports. The diagram and charts PRDs defer this promotion explicitly — the rollout must include: remove `@internal` JSDoc markers, add exports to package `index.ts` for the new variant presets, write CHANGELOG entries, and update README examples.

**Recommended revised sequence:**
1. Audit and align chart series material profiles to note spec (or update note to match code — resolve the discrepancy first).
2. Audit and finalize diagram polarity variant values against section 4 quality bar.
3. Apply neutral swatch and accent palette values to diagram/chart theme files where they diverge.
4. Tune per-family flow speed, pulse intensity, and emissive to section 7 ranges.
5. Remove `@internal` markers; promote polarity variants to public exports; update CHANGELOG and READMEs.
6. Add at least one example in `apps/examples/` showing all 12 variants.
7. (Separate track) Resolve webglFontUrl hosting and add to presets when available.

---

### 5. Slides `ThemeFamily → DeckTheme` Mapper — Scope Risk

As noted in Finding 1, the mapper is already shipped. The scope concern is different: **slides maintains its own token set independent of core's `SCENE_THEME_PAIRS`.**

If a `bg-900` hex value changes in the note (or core), slides won't automatically update — `DECK_THEME_PAIRS` in slides has hardcoded values. This is a long-term drift risk. The note should state whether the slide token values are intended to be structurally derived from the `SCENE_THEME_PAIRS` values or whether slides is a deliberately independent token set.

Based on code review, slides values are well-aligned with the note (e.g., `darkGlass.dark.background.color: '#070504'` matches note `bg-900` dark `#070504`; `darkGlass.dark.colors.heading: '#F2E6DE'` matches note `text-100` dark). This is good, but the alignment is maintained by manual coordination, not by structural derivation. The slides mapper should not be in scope for this feature.

**Recommendation**: Remove slides from this feature's scope entirely. Document in the note that `DECK_THEME_PAIRS` values are manually coordinated with the core note and should be reviewed when this note is updated.

---

### 6. Token Value Discrepancies

The most significant finding: **the chart series material profiles in the note diverge meaningfully from the implemented code**. This needs resolution before a plan can be written.

Key discrepancies found by comparing note section 5.1.2b to `packages/charts/src/themes/darkGlass.ts` and `darkGlassLight.ts`:

| Token | Note (dark) | Code (dark) | Note (light) | Code (light) |
|---|---|---|---|---|
| `metalness` | `0.18` | `0.18` ✓ | `0.10` | `0.50` ✗ |
| `roughness` | `0.22` | `0.12` ✗ | `0.34` | `0.14` ✗ |
| `transmission` | `0.14` | `0.14` ✓ | `0.02` | `0.02` ✓ |
| `depth` | `0.24` | `0.24` ✓ | `0.18` | `0.18` ✓ |

The roughness discrepancy (`0.22` vs `0.12` for dark; `0.34` vs `0.14` for light) is a visual quality gap — roughness at `0.22` produces a noticeably glossier surface than `0.12`. Whether the note or the code is correct is a visual judgment call, but the discrepancy must be resolved.

For the light variant `metalness` (`0.10` note vs `0.50` code): `0.50` metalness on a light-background chart is unusually high and could cause dark, mirror-like surfaces that don't read well on light backgrounds. The note's `0.10` value is more appropriate for a light-polarity theme. This looks like an implementation error that the note's spec would correct.

I have not audited all families systematically — that verification should be part of the plan's definition of done.

---

### 7. Does `background.effects.overlayGradient` Require a Type Change?

No. `SceneThemeBackgroundEffects.overlayGradient?: string` is an existing optional field in `packages/core/src/theme/types.ts` (line 101). `BackgroundWidget` already reads and applies it. The `presets.ts` file already uses it in all 12 theme presets. This field does not require any type change. The note treating this as an open question implies the note was authored without a current-state audit of the type system. No type change needed.

---

### PM-1 Verdict

**The note is conceptually sound but requires revision before plan authoring.** The art direction tables are detailed and implementation-grade. The family design intents are well-differentiated. The accent palette coordination between diagram and charts is strong.

Required before plan authoring:
1. **Resolve the chart series material profile discrepancies** (roughness and light-variant metalness). Decide: does the note override the code, or does the code inform the note?
2. **Remove slides from scope** — it's already done.
3. **Remove `webglFontUrl` from this rollout** — it's a separate deployment dependency.
4. **Add tooltip and projection token art direction** to chart theme targets (sections 5.x.5).
5. **Clarify which items in core are "already done"** vs. "still to do" — the note currently treats all core work as future work when it's shipped.
6. **Add diagram `glowSpread`, `glowIntensity`, and flow tuning targets** per family — the note omits these and they drive significant visual differentiation across families.

---

## PM-2 Consensus Summary

**Reviewers:** PM-1 (brewsite-product-manager) and PM-2 (brewsite-product-manager)
**Date:** 2026-03-12
**Status:** Full consensus reached. The note requires one targeted update before the architect can begin planning (see "What the Architect Needs Before Planning").

---

### Agreed Scope (What This Feature Will Implement)

1. **Chart polarity variant material corrections** — Apply note-authoritative light-variant values to all chart light theme files. See authority table below.
2. **Tooltip and projection token art direction** — Extend sections 5.x.5 for all 6 families × 2 polarities to include `tooltip` and `projection` token specs. The midnight chart theme (dark and light) currently has blue tooltip/projection colors on a warm amber family — a confirmed copy-paste error that can only be caught and corrected via this spec. This is hard in-scope.
3. **Diagram polarity variant art direction** — Add per-family exact values for `glowSpread`, `glowIntensity`, `sideColorDarkenFactor`, `borderColorLightenFactor`, and edge `defaultFlowSpeed`/`flowPulseIntensity` to sections 5.x.4.
4. **Motion/interaction tuning** — Align `ChartTheme.series.emissiveIntensity` and `DiagramTheme.edge.defaultFlowSpeed`/`flowPulseIntensity` to section 7 ranges.
5. **`@internal` promotion** — Remove `@internal` markers from diagram and chart polarity variants; export from package `index.ts` files; write CHANGELOG entries for all affected packages.
6. **Example coverage** — Add at least one scene in `apps/examples/` demonstrating all 12 family × polarity variants side-by-side.

---

### Explicitly Descoped Items

| Item | Rationale |
|---|---|
| `@brewsite/core` presets | **Already complete.** All 12 `SceneTheme` presets in `packages/core/src/theme/presets.ts` have production values matching this note. Section 2's "core is a gap" statement is incorrect. |
| `@brewsite/slides` ThemeFamily → DeckTheme mapper | **Already shipped.** `packages/slides/src/themeFamily.ts` implements `DECK_THEME_PAIRS` for all 6 families × 2 polarities. Values are manually coordinated with this note. Review on note updates, but no code changes in scope. |
| `webglFontUrl` per family in presets | **Deployment dependency, not a theme API change.** Requires MSDF font files to be hosted on a CDN. Font family names are already in this note (section 6). Add `webglFontUrl` to presets in a separate track once hosting is resolved. |
| `background.effects.overlayGradient` type change | **Not needed.** The field exists at `packages/core/src/theme/types.ts:101` (`SceneThemeBackgroundEffects.overlayGradient?: string`) and is used in all 12 core presets. |

---

### Authoritative Answer on Material Value Discrepancy

The note and implemented code diverge on chart series material tokens. The following table is the resolved authority for all 6 families:

| Token | Authority | Rationale |
|---|---|---|
| **Dark roughness** (`0.12` code, `0.22` note) | **Code (`0.12`)** | Lower roughness produces a more glass-like, reflective surface — correct for glass-aesthetic families. The note's `0.22` is a rounding artifact. |
| **Light metalness** (`0.50` code, `0.10` note) | **Note (`0.10`)** | `0.50` metalness on a light-background chart creates dark, mirror-like surfaces against cream backgrounds. Confirmed implementation error. |
| **Light roughness** (`0.14` code, `0.34` note) | **Note (`0.34`)** | `0.14` is too glassy for light polarity; reflections compete with data labels and gridlines. Note's `0.34` is correct for light-polarity legibility. |
| All other values | **Match** | No action needed. |

The architect must apply this authority table per-family when updating all chart light theme files.

---

### Confirmed Correctness Issue: Midnight Tooltip/Projection

`packages/charts/src/themes/midnight.ts` (dark) and `packages/charts/src/themes/midnightLight.ts` (light) both contain **blue tooltip and projection colors** on a warm amber/terracotta family. This is a copy-paste error:

- `tooltip.borderColor`: `rgba(107,155,255,0.3)` (blue) — should be amber-family
- `tooltip.valueColor`: `#C8D8FF` (cool blue) — should be warm cream
- `projection.color`: `#6B9BFF` (blue beam) — should be amber-family

The midnight light variant has the same pattern (`rgba(79,100,200,0.25)` border, `#4F64C8` projection). Correct amber-family values must be specified in the note's section 5.2.5 before the architect can code the fix.

**Validation rule for the architect:** When writing the plan, flag any `tooltip.borderColor` or `projection.color` value that belongs to a different family's accent palette. A blue value in a warm-toned family is an automatic error.

---

### Corrections to Section 8 Rollout Targets

| Package | Revised Status |
|---|---|
| `@brewsite/core` (`presets.ts`) | **Done — no changes needed** |
| `@brewsite/slides` (`themeFamily.ts`) | **Done — remove from section 8** |
| `@brewsite/charts` (`themes/*.ts`) | **Real work remaining:** fix light metalness/roughness; add tooltip/projection specs; correct midnight colors |
| `@brewsite/diagram` (`themes/*.ts`) | **Real work remaining:** add per-family glow + flow targets to note; tune against section 7 ranges |
| `@brewsite/model` | Validate inherited overlay fonts and contrast — low effort, keep in scope |

---

### Revised Rollout Sequence

**Step 0 (Prerequisite):** This document's consensus summary resolves material value authority. No planning work begins until this section is written (done).

1. Update the note: extend sections 5.x.5 with tooltip/projection token specs for all 6 families × 2 polarities. Specify correct amber-family midnight values. Extend sections 5.x.4 with diagram glow and flow tuning targets.
2. Apply note-spec material corrections to all chart light theme files (metalness `0.10`, roughness `0.34`). Fix midnight tooltip/projection colors per the note's new specs.
3. Audit and align diagram polarity variant values (`glowSpread`, `glowIntensity`, flow speed/pulse) against sections 5.x.4 targets.
4. Tune `ChartTheme.series.emissiveIntensity` and `DiagramTheme.edge` motion values to section 7 ranges.
5. Remove `@internal` markers; promote polarity variants to public exports; update CHANGELOG and READMEs for all affected packages.
6. Add `apps/examples/` scene demonstrating all 12 variants.
7. *(Separate track)* Resolve `webglFontUrl` CDN hosting; add MSDF font URLs to presets when available.

---

### What the Architect Needs Before Planning Can Begin

**Step 1 of the rollout sequence (note update) must happen before architecture planning begins.** Specifically:

- Sections 5.x.5 (all 6 families) must include `tooltip` and `projection` token specs.
- The midnight tooltip/projection values in the note must be specified as amber-family values, not the blue values currently in the code.
- Sections 5.x.4 (all 6 families) must include per-family exact values for `glowSpread`, `glowIntensity`, `sideColorDarkenFactor`, `borderColorLightenFactor`.

Without these additions, the architect cannot specify exact code values for the chart tooltip/projection corrections or the diagram glow tuning. The plan would have to leave these as "TBD," which is unacceptable for an implementation-grade plan.
