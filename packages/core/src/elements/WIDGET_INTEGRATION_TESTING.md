# Widget Integration Testing Guide

This document establishes the testing pattern for widget compilation pipelines — the seam where DSL props, theme tokens, and compiled defaults merge into a widget's compiled state.

## Why Integration Tests Matter

Every widget has a compilation pipeline:

```
DSL JSX props → NodeHandler (or parent handler) → theme resolution → compile function → compiled state → widget.apply()
```

**Unit tests** cover the pure functions (`compile.ts`, `geometry.ts`, etc.) in isolation.
**Integration tests** cover the pipeline seam — how those functions are wired together.

Bugs almost never live in the pure functions. They live in:
- How props are extracted from JSX elements
- How theme tokens are resolved and merged with DSL props
- How the merge priority (DSL > theme > defaults) is enforced
- How undefined values are stripped vs. preserved
- How compiled state reaches the widget

If the integration seam is untested, the pure function tests create **false confidence** — every test passes, but the user sees bugs because the wiring is wrong.

## The Pattern

### 1. Child widgets compiled by a parent handler

Some widgets are compiled as a side effect of their parent's `NodeHandler`. The child's DSL component has a no-op handler (or none at all). The parent extracts child props, resolves theme, and emits state.

**Example**: `<CarouselTray>` is compiled by `viewLayoutHandler` when it appears inside `<ViewLayout kind="carousel">`.

**Testing strategy**: Extract the compilation logic into a **pure function** that can be tested with real inputs and real theme state.

```typescript
// compileTray.ts — extracted from viewLayoutHandler
export function compileTrayFromViewLayout(
  trayProps: CarouselTrayProps,
  layoutId: string,
  carouselConfig: CarouselLayoutConfig,
  viewIds: readonly string[],
  composedContainerBounds: NVSRect,
  viewStates: ReadonlyMap<string, TrayViewBounds>,
  themeFamily: ThemeFamily,
  themePolarity: 'dark' | 'light',
): CarouselScrubberState { ... }
```

**Integration test structure**:

```typescript
import { registerSceneThemePair, _resetSceneThemeRegistryForTesting } from '../../theme/sceneThemeRegistry';

beforeEach(() => {
  _resetSceneThemeRegistryForTesting();
  registerSceneThemePair('testTheme', { dark: myDarkTheme, light: myLightTheme });
});

it('DSL surfacePattern overrides theme surfacePattern', () => {
  const state = compileTrayFromViewLayout(
    { surfacePattern: 'brushed' },  // DSL prop
    'layout-1',
    carouselConfig,
    viewIds,
    containerBounds,
    viewStates,
    'testTheme',  // theme has surfacePattern: 'grain'
    'dark',
  );
  expect(state.style.surfacePattern).toBe('brushed');  // DSL wins
});
```

### 2. Standalone widgets with their own NodeHandler

Widgets registered via `registerNode(Component, handler)` are compiled directly by the compiler when their DSL component is encountered.

**Testing strategy**: Build a real JSX tree, compile it with `resolveSceneFromDsl()`, and assert the widget state in the compiled `SceneFrame`.

```typescript
import { resolveSceneFromDsl, Scene } from '../../compiler/sceneDslCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

it('compiles MyWidget with correct state', () => {
  registerCoreHandlers();
  registerNode(MyWidget, myWidgetHandler);

  const tree = (
    <Scene id="test">
      <MyWidget id="w1" color="#ff0000" />
    </Scene>
  );

  const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
  const state = frame.widgets['w1'] as MyWidgetState;
  expect(state.color).toBe('#ff0000');
});
```

## What to Test

For every widget that participates in theme resolution, test these scenarios:

| Scenario | What to assert |
|---|---|
| **DSL prop passthrough** | Each DSL prop reaches the compiled state |
| **Theme token application** | When no DSL prop, theme token fills the value |
| **DSL overrides theme** | DSL prop wins over theme token |
| **No DSL, no theme** | Compiled default applies |
| **Partial DSL + partial theme** | DSL fields override, theme fills the rest |
| **Light vs dark polarity** | Correct polarity variant is used |
| **Unknown theme family** | Falls back to 'default' without crashing |
| **Carousel/layout config passthrough** | loop, activeIndex, childCount are correct |
| **View extent computation** | Tight bounding box is computed correctly |

## Anti-Patterns

### Don't test dead code

If a function exists but is never called in the production pipeline, delete it. Testing dead code creates false confidence that the feature works when it doesn't.

### Don't use mocks for pure functions

The compilation pipeline is pure. Pass real inputs, assert real outputs. If you need `vi.fn()` to test a compile function, the function isn't pure — fix the design.

### Don't test only the pure function

Testing `compileCarouselScrubber()` alone misses the integration seam where bugs live. Always test the full pipeline from DSL props through theme resolution to compiled state.

### Don't put theme resolution in `render.ts`

Theme resolution must happen at **compile time**, not render time. The compiled state IS the final themed state. Render-time theme resolution creates stale-reference bugs (Object.is equality on theme objects).

## File Organization

```
elements/my-widget/
  types.ts              ← interface contracts
  dsl.tsx               ← DSL component + prop types
  compile.ts            ← pure compilation functions
  compileTray.ts        ← extracted integration function (for child widgets)
  render.ts             ← Three.js application (excluded from test coverage)
  MyWidget.ts           ← IWidget implementation
  __tests__/
    compile.test.ts     ← unit tests for pure functions
    compileTray.test.ts ← INTEGRATION tests for the full pipeline
    geometry.test.ts    ← unit tests for geometry math
```

The integration test file (`compileTray.test.ts`) is the most important test file in the module. It catches bugs that unit tests miss.

## Reference Implementation

See `packages/core/src/elements/carousel-scrubber/__tests__/compileTray.test.ts` for the canonical example of widget integration testing with 40 tests covering all scenarios in the table above.
