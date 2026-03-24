---
title: "Plugin Multi-Engine Safety — Move Widget Instantiation into createWidgets()"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-23
---

# Plugin Multi-Engine Safety

## 1. Problem Statement

Plugin factories like `corePlugin()` create widget instances in their closure and return the same objects from `createWidgets()` on every call. When multiple `SceneEngine` instances share the same plugin object (common in MDX pages, docs, multi-engine layouts), they register the **same widget instances**. The second engine's `widget.initialize(context)` overwrites the first engine's renderer/camera/scene refs, causing:

- Cross-engine input leakage (orbiting embed A moves embed B's camera)
- Shared mutable state across RAF loops (last `apply()` wins)
- Incorrect dispose behavior (first engine's `dispose()` tears down the second engine's resources)

### Current state by plugin

| Plugin | Widgets in closure? | Safe for multi-engine? |
|---|---|---|
| `corePlugin` | **Yes** — 7 widgets created in closure, returned from `createWidgets()` | ❌ Broken |
| `slidesPlugin` | **Yes** — `SlideMetaWidget` + `SlideNavWidget` in closure | ❌ Broken |
| `diagramPlugin` | No — `createWidgets()` returns `[]`; widgets created lazily | ✅ Safe |
| `modelPlugin` | No — widgets created lazily via `registerTypeFactory` | ✅ Safe |
| `chartPlugin` | No — widgets created lazily per `<Chart>` node | ✅ Safe |
| `screensPlugin` | No — widgets created lazily per node handler | ✅ Safe |
| `themesPlugin` | No — no widgets at all | ✅ Safe |
| `texturesPlugin` | No — no widgets at all | ✅ Safe |

Only **`corePlugin`** and **`slidesPlugin`** need changes.

---

## 2. Design

### Principle

`createWidgets()` must create **new widget instances** each time it is called. The plugin closure captures configuration (options, callbacks, manifest URLs) but never widget instances. Cross-method widget access uses `registry.get(id)` lookups, not closure variables.

### Pattern (before → after)

**Before** (broken):
```typescript
export function corePlugin(): WidgetPlugin {
  const cameraWidget = new CameraWidget();         // created ONCE
  const lightingWidget = new LightingWidget();     // created ONCE
  return {
    createWidgets() {
      return [cameraWidget, lightingWidget, ...];  // same instances
    },
    configureRegistry(reg) {
      lightingWidget.setLightingOverrides(...);     // closure reference
    },
  };
}
```

**After** (safe):
```typescript
export function corePlugin(): WidgetPlugin {
  return {
    createWidgets() {
      return [                                     // fresh instances each call
        new CameraWidget(),
        new LightingWidget(),
        new BackgroundWidget(),
        new EnvironmentWidget(),
        new FloorWidget(),
        new SceneMetaWidget(),
        new SpotlightRigWidget(),
      ];
    },
    configureRegistry(reg) {
      const lighting = reg.get('lighting') as LightingWidget;
      lighting.setLightingOverrides(...);          // registry lookup
      const floor = reg.get('floor') as FloorWidget;
      floor.setRegistry(reg);
    },
  };
}
```

---

## 3. Changes

### 3.1 `packages/core/src/player/plugins.ts` — `corePlugin()`

**Move widget construction into `createWidgets()`:**

Replace lines 57–69:
```typescript
// BEFORE:
const lightingWidget = new LightingWidget();
const backgroundWidget = new BackgroundWidget();
const environmentWidget = new EnvironmentWidget();
const floorWidget = new FloorWidget();
const cameraWidget = new CameraWidget();
const sceneMetaWidget = new SceneMetaWidget({ onSceneChange: options?.onSceneChange });
const spotlightRigWidget = new SpotlightRigWidget();

return {
  createWidgets() {
    return [lightingWidget, backgroundWidget, environmentWidget,
            floorWidget, cameraWidget, sceneMetaWidget,
            spotlightRigWidget];
  },
```

With:
```typescript
// AFTER:
return {
  createWidgets() {
    return [
      new LightingWidget(),
      new BackgroundWidget(),
      new EnvironmentWidget(),
      new FloorWidget(),
      new CameraWidget(),
      new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
      new SpotlightRigWidget(),
    ];
  },
```

**Update `configureRegistry()` to use registry lookups:**

Replace:
```typescript
configureRegistry(reg) {
  const overrideWidgets = [...reg.getAllWidgets()].filter(isLightingOverride);
  lightingWidget.setLightingOverrides(overrideWidgets);
  floorWidget.setRegistry(reg);
},
```

With:
```typescript
configureRegistry(reg) {
  const lighting = reg.get('lighting');
  if (lighting && 'setLightingOverrides' in lighting) {
    const overrideWidgets = [...reg.getAllWidgets()].filter(isLightingOverride);
    (lighting as LightingWidget).setLightingOverrides(overrideWidgets);
  }
  const floor = reg.get('floor');
  if (floor && 'setRegistry' in floor) {
    (floor as FloorWidget).setRegistry(reg);
  }
},
```

The `'setLightingOverrides' in lighting` guard is a duck-type check that avoids a hard cast. It also makes `configureRegistry` safe to call even if some widgets are not registered (e.g., a hypothetical future "headless" mode without lighting).

**Verify no other methods reference closure widgets:**

Per the research, `reconcileCompiledTrack` does NOT reference closure widgets — it only uses the `registry` parameter. No other methods (`onRendererCreated`, `onRendererDisposing`, etc.) exist on `corePlugin`. Confirmed safe.

### 3.2 `packages/slides/src/plugin.ts` — `slidesPlugin()`

**Move widget construction into `createWidgets()`:**

Replace:
```typescript
const metaWidget = new SlideMetaWidget();
return {
  createWidgets() {
    return [metaWidget, new SlideNavWidget()];
  },
```

With:
```typescript
return {
  createWidgets() {
    return [new SlideMetaWidget(), new SlideNavWidget()];
  },
```

**Update `registerHandlers()` to use a constant widget ID:**

The only closure reference to `metaWidget` in `registerHandlers` is `metaWidget.widgetId`. Since `SlideMetaWidget.widgetId` is a fixed string, extract it as a constant.

In `SlideMetaWidget.ts` (or at the top of `plugin.ts`):
```typescript
export const SLIDE_META_WIDGET_ID = 'slide-meta';
```

Then in the node handler inside `registerHandlers()`:
```typescript
// BEFORE:
api.setWidgetState(metaWidget.widgetId, { ... });

// AFTER:
api.setWidgetState(SLIDE_META_WIDGET_ID, { ... });
```

If `SlideMetaWidget` already defines its widgetId as a string literal, verify it matches and use the exported constant.

### 3.3 `packages/core/src/widget/WidgetRegistry.ts` — Verify `get()` API

The registry already has `get(id: string): IWidget | undefined`. No changes needed.

### 3.4 No changes needed for other plugins

`diagramPlugin`, `modelPlugin`, `chartPlugin`, `screensPlugin`, `themesPlugin`, and `texturesPlugin` already create widgets lazily and do not capture widget instances in their closures. They are already multi-engine safe.

---

## 4. Migration for `DiagramEmbed` / MDX Example

After this fix, the MDX example can safely share a single plugin array across embeds again:

```mdx
export const plugins = [corePlugin(), diagramPlugin(), themesPlugin()];

<SceneEmbed plugins={plugins} ...> ... </SceneEmbed>  {/* ✅ fresh widgets */}
<SceneEmbed plugins={plugins} ...> ... </SceneEmbed>  {/* ✅ fresh widgets */}
```

However, `DiagramEmbed`'s current approach of `useMemo(() => [corePlugin(), ...], [])` is also correct and has negligible overhead. Both patterns work after this fix. The `DiagramEmbed` approach is more defensive (works even with unfixed third-party plugins), so it can remain as-is.

---

## 5. Implementation Sequence

1. **`packages/core/src/player/plugins.ts`** — Move widget instantiation into `createWidgets()`, update `configureRegistry()` to use `reg.get()` lookups.
2. **`packages/slides/src/plugin.ts`** — Move widget instantiation into `createWidgets()`, extract `SLIDE_META_WIDGET_ID` constant, update `registerHandlers()`.
3. **Typecheck:** `pnpm typecheck` — all packages must pass.
4. **Test:** `pnpm test` — all packages must pass. Existing tests already exercise the plugin → engine → widget pipeline. No new tests needed for this refactor (the behavior is identical; only the allocation timing changes).
5. **Manual verification:** Run the MDX embed example with shared plugins and confirm both embeds have independent camera state.

---

## 6. Testing Strategy

This is a **pure refactor** — the observable behavior is identical. Existing tests cover:

| Test | What it verifies | File |
|---|---|---|
| CameraWidget tests | Widget state, interaction, scene changes | `packages/core/src/elements/camera/__tests__/CameraWidget.test.ts` |
| Plugin integration | Widget registration, handler wiring | `packages/core/src/player/__tests__/` |
| Diagram widget tests | Lazy widget creation, compilation | `packages/diagram/src/elements/diagram/__tests__/` |
| SceneEmbed tests | Container layout, prop forwarding | `packages/core/src/player/__tests__/SceneEmbed.test.tsx` |

No new tests are needed. The refactor changes allocation timing (closure → `createWidgets()` call) but not the widget instances' types, IDs, or behavior.

---

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `configureRegistry` runs before widgets are registered | None — SceneEngine calls `createWidgets()` → `register()` → `configureRegistry()` in that order | Existing call order in SceneEngine.tsx lines 241–266 |
| `reg.get('lighting')` returns undefined | None in practice — `corePlugin` always creates `LightingWidget` with id `'lighting'` | Duck-type guard (`'setLightingOverrides' in lighting`) handles edge cases |
| SlideMetaWidget ID string mismatch | Low — verify the string literal matches `SlideMetaWidget.widgetId` | Extract as a shared constant |
| Third-party plugins still capture widgets in closure | Possible — not our code | `DiagramEmbed`'s per-instance `useMemo` pattern is documented as the defensive approach |
