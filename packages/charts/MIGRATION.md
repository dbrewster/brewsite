# @brewsite/charts Migration Guide

## v2.x — NVS Universal Coordinate System

### `ChartState.bounds.width` and `.height` are now NVS fractions

**Change:** `bounds.width` and `bounds.height` changed from world-space units to
NVS fractions in the range [0..1]. `bounds.depth` remains world-space and is unchanged.

**Before (world-unit values):**
```typescript
// Old: chart occupied 8.89 × 5.0 world units on a worldScale=10 scene
<Chart
  id="revenue"
  type="bar"
  bounds={{ width: 8.89, height: 5 }}
/>
```

**After (NVS fractions):**
```typescript
// New: chart occupies 50% of viewport width × 50% of viewport height
<Chart
  id="revenue"
  type="bar"
  bounds={{ width: 0.5, height: 0.5 }}
/>
```

**Default values also changed:**
- Before: `bounds = { width: 4, height: 3, depth: 0.4 }`
- After:  `bounds = { width: 1.0, height: 1.0, depth: 0.4 }`

The new default (1.0 × 1.0) means the chart fills its declared NVS region
(`x/y/w/h` props) by default. This is the most common case.

### Conversion formula

To migrate from world-unit bounds to NVS fractions, divide by the visible world
dimensions at your scene's `worldScale`:

```
nvsWidth  = worldWidth  / visibleWorldWidth
nvsHeight = worldHeight / visibleWorldHeight
```

For a `worldScale=10` scene (`visibleWorldWidth ≈ 17.78`, `visibleWorldHeight ≈ 10.0`):
```
bounds={{ width: 8.89, height: 5.0 }}  →  bounds={{ width: 0.5, height: 0.5 }}
bounds={{ width: 17.78, height: 10.0 }} →  bounds={{ width: 1.0, height: 1.0 }}
```

### Transition spec migration

Any scene that authors `bounds.width` or `bounds.height` in transition `enter`/`exit`
overrides must reauthor those values from world-unit ranges to NVS fractions [0..1].

**Before:**
```typescript
// enter: grow from 0 world units to full size
enter={{ bounds: { width: 0, height: 0 } }}  →  bounds={{ width: 8.89, height: 5 }}
```

**After:**
```typescript
// enter: grow from 0 NVS fraction to full size
enter={{ bounds: { width: 0, height: 0 } }}  →  bounds={{ width: 0.5, height: 0.5 }}
```

### `ChartWidget.apply()` internals

`ChartWidget` now uses `context.coords` (a `NVSCoordService`) to convert NVS bounds
to world-space. The `private cameraRef` stash and the `nvsToWorldAnalytic()` hardcoded
fallback have been removed. This requires `WidgetRenderContext.coords` to be populated,
which the `RuntimeDriverImpl` handles automatically.

No changes are required in consuming code unless you were constructing `WidgetRenderContext`
objects manually (e.g., in tests). Those must now include a `coords` field:

```typescript
import { createNVSCoordService } from '@brewsite/core';
import * as THREE from 'three';

const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
camera.position.set(0, 0, 12.07);
const coords = createNVSCoordService(camera, 1920, 1080);

const ctx: WidgetRenderContext = {
  // ... other fields ...
  coords,
};
```
