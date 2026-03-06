---
title: "Fix: React key-prop warning for TextBox and overlay nodes in EngineOverlayHost"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-05
---

# Plan: Fix React key-prop warning for TextBox overlay nodes

## Root Cause

The React "Each child in a list should have a unique key prop" warning originates in the compiler pipeline at the point where `sceneRootHandler` stores overlay nodes, and surfaces when `EngineOverlayHost` renders them. The chain of evidence:

### Step 1 — `collectChildren` uses `Children.toArray`

`packages/core/src/compiler/sceneDslCompiler.ts:111`

```ts
const collectChildren = (node: ReactElement): unknown[] =>
  Children.toArray(/* ... */).flatMap(expandNode);
```

`Children.toArray` **does** assign stable keys to every element it processes — it prefixes them with `.$`. So by the time elements reach `compileChildrenSeparated`, they carry keys assigned by React.

### Step 2 — `compileChildrenSeparated` routes non-DSL elements into `overlayNodes: ReactNode[]`

`packages/core/src/compiler/sceneDslCompiler.ts:139–203`

`TextBox` is not a registered `NodeHandler` (confirmed: `coreHandlers.ts` does not register it, and `coreHandlers.ts` is the only registration call that runs). `TextBox` is a function component (`typeof element.type === 'function'`), so the code path at line 167 applies:

```ts
if (typeof childEl.type === 'function' && !isPrimitiveComponent(childEl.type)) {
  const expanded = expandNode(childEl);
  ...
}
```

`expandNode` is called on the `<TextBox>` element. Inside `expandNode` (line 95):

```ts
if (typeof element.type === 'function' && !isPrimitiveComponent(element.type)) {
  let next: unknown;
  try {
    next = (element.type as (props: ...) => unknown)(props);
  } catch { ... }
  return expandNode(next);
}
```

`TextBox` is a pure function component that does not use hooks, so the try-block succeeds. `TextBox(props)` executes and returns a `<div>` JSX element. `expandNode` recurses on that `<div>`, and because its type is the string `'div'` (not a function and not a Fragment), the base case `return [node]` fires — returning the rendered `<div>`.

This means `<TextBox id="bfm-hero-content" ...>` is **unwrapped during compilation**: the `<TextBox>` element is replaced by its rendered inner `<div>`.

### Step 3 — The rendered `<div>` has no `key`

The `<div>` returned by calling `TextBox(props)` directly is a freshly-created React element. It was not created via JSX in a component render cycle — it was created by invoking the function directly in the compiler. The `key` that the original `<TextBox>` element carried (assigned either by the scene author or by `Children.toArray`) is on the **outer** `<TextBox>` element, not on the inner `<div>` it returns. When the `<div>` is pushed into `overlayNodes`, it has `key: null`.

### Step 4 — `overlayNodes` is stored as a bare `ReactNode[]` array

`packages/core/src/compiler/sceneDslCompiler.ts:339–341`

```ts
const overlayNodes = helpers.compileChildrenSeparated(node, api);
if (overlayNodes.length > 0) {
  api.state.sceneOverlay = overlayNodes;
}
```

`SceneFrame.sceneOverlay` is typed as `ReactNode` but receives a `ReactNode[]` array. React accepts arrays as valid `ReactNode` values and will render them — but it requires every sibling element in the array to carry a `key` prop.

### Step 5 — `EngineOverlayHost` renders the array directly

`packages/core/src/player/EngineOverlayHost.tsx:91`

```tsx
{overlay}
```

`overlay` is `sceneOverlays.get(sceneId)`, which is the `ReactNode[]` array. React iterates this array during reconciliation. Every element in the array that has `key: null` triggers the "Each child in a list should have a unique key prop" warning. React's component-attribution heuristic walks up the render tree and names the warning source as the last named component that touched the tree — which is `EngineOverlayHost`.

### Why the stack trace mentions `TextBox @ dsl.tsx:35`

React's key-warning machinery captures the component stack at the point where the keyless element is rendered. Line 35 in `dsl.tsx` is `<div` — the return site of the `TextBox` function. React attributes the element creation there, even though `TextBox` was called in the compiler rather than in a normal render cycle.

### Summary

The root cause is that `expandNode` calls function components directly (to walk the DSL tree), which strips any `key` that the author placed on the original `<TextBox>` element. The unwrapped inner element has no `key`, and it ends up in a sibling array rendered by `EngineOverlayHost`.

This is a **library bug** in `sceneDslCompiler.ts`. The `expandNode` function is designed for walking DSL components (components that return `null` or other DSL nodes) — not for rendering pure-React overlay components. `TextBox` is the degenerate case: it is a registered export of `@brewsite/core` that acts as an overlay component, but it is also a renderable function component that `expandNode` can call successfully, producing an unwrapped keyless element.

---

## Exact Files and Changes

### Fix 1 — Preserve overlay elements without unwrapping them (primary fix)

**File:** `packages/core/src/compiler/sceneDslCompiler.ts`

**Location:** `compileChildrenSeparated`, lines 167–199 (the `typeof childEl.type === 'function'` branch that handles non-registered function components).

**Current behavior:** Non-registered function components are passed to `expandNode`, which attempts to call them. If they render HTML, the unwrapped HTML nodes enter `overlayNodes` without the key from the original wrapper element.

**Required behavior:** Before calling `expandNode` on a non-registered function component, the code must first check whether the component can be identified as an overlay component — and if so, preserve it as-is rather than expanding it. `TextBox` is the canonical example: it is a pure layout component with no DSL semantics. Its identity as an overlay is signalled by the fact that it has no registered `NodeHandler` and its call through `expandNode` produces only HTML output (no DSL nodes).

The existing code already has the `pendingHtml` staging logic that sets `anyCompiled = false` when no DSL nodes are found. In this case, `pendingHtml` contains the unwrapped `<div>`, not the original `<TextBox>` — and the `<div>` has no key.

**The minimal correct fix** is: when `expanded` contains no DSL nodes (`anyCompiled` stays false) and the expansion produced nodes that all came from unwrapping the same single component, use the original `childEl` (the `<TextBox>` element with its `key` intact) rather than the expanded inner nodes. This is already what the final `else` branch does (`overlayNodes.push(childEl)`) — but the `pendingHtml.length > 0` branch prefers the unwrapped nodes instead.

Concretely: **remove the `pendingHtml.length > 0` special case** (lines 192–194) and let all non-DSL function components fall through to `overlayNodes.push(childEl)`. The original `<TextBox>` element carries the author's `key` prop and, when React renders it in `EngineOverlayHost`, it will call `TextBox` normally and render the inner `<div>` — so the visual output is identical. The only change is that `TextBox` (and any similar overlay function components) are preserved as opaque React elements rather than being pre-called at compile time.

**Lines to change (sceneDslCompiler.ts, inside `compileChildrenSeparated`):**

```ts
// BEFORE (lines 189–198):
if (anyCompiled) {
  // Mixed component: DSL parts compiled, HTML parts become overlay
  overlayNodes.push(...pendingHtml);
} else if (pendingHtml.length > 0) {
  // HTML-only expansion: use the individual collected nodes (not the wrapper)
  overlayNodes.push(...pendingHtml);
} else {
  // No expansion yield at all: treat whole element as overlay
  overlayNodes.push(childEl);
}

// AFTER:
if (anyCompiled) {
  // Mixed component: DSL parts compiled, HTML parts become overlay
  overlayNodes.push(...pendingHtml);
} else {
  // No DSL output (HTML-only expansion or no yield at all):
  // Preserve the original element so its key prop survives to the render phase.
  // React will call the component normally when EngineOverlayHost renders it.
  overlayNodes.push(childEl);
}
```

This collapses the `else if (pendingHtml.length > 0)` branch into the final `else`. The key from the author's `<TextBox id="bfm-hero-content">` element — assigned by `Children.toArray` as `'.$bfm-hero-content'` — is preserved on `childEl` and flows through to `EngineOverlayHost`.

**Side-effect consideration:** The `pendingHtml` variable and its collection loop become dead code for the `else` branch. However, `pendingHtml` is still needed for the `anyCompiled` path (mixed components that yield both DSL and HTML output). No further change is needed there; only the branch that handles HTML-only expansion is collapsed.

### Fix 2 — Wrap the overlay array in a Fragment before storing (defence-in-depth)

**File:** `packages/core/src/compiler/sceneDslCompiler.ts`

**Location:** `sceneRootHandler`, lines 338–341.

After Fix 1, individual `<TextBox>` elements will carry keys. However, the overlay is still stored as a raw `ReactNode[]` array. `EngineOverlayHost` renders `{overlay}` where `overlay` is this array. React accepts arrays as `ReactNode` values, but any future overlay element added without a key will re-trigger the warning.

**Recommended change:** Wrap `overlayNodes` in a React Fragment before storing it on `api.state.sceneOverlay`. This converts the key-management responsibility from the individual overlay nodes to the Fragment — React does not require keys on Fragment children when the Fragment itself is not in a sibling list.

```ts
// BEFORE (sceneRootHandler, lines 338–341):
const overlayNodes = helpers.compileChildrenSeparated(node, api);
if (overlayNodes.length > 0) {
  api.state.sceneOverlay = overlayNodes;
}

// AFTER:
const overlayNodes = helpers.compileChildrenSeparated(node, api);
if (overlayNodes.length > 0) {
  api.state.sceneOverlay = React.createElement(React.Fragment, null, ...overlayNodes);
}
```

This requires importing `React` in `sceneDslCompiler.ts`. The file already imports from `'react'` (line 1) and destructures named exports. Add `React` as the default import, or use `createElement` and `Fragment` from the existing destructured imports (both are already available in the React 19 named-export model via `import { createElement, Fragment } from 'react'`).

Fix 2 is strictly defence-in-depth. Fix 1 is the primary fix. Both should be applied together.

---

## Test Strategy

### Test location
`packages/core/src/compiler/__tests__/sceneDslCompiler.test.ts` (create or extend)

### Test 1 — TextBox overlay element preserves its key through compilation

Construct a `<Scene id="test">` JSX element with a `<TextBox id="tb1" x={0} y={0} w={1} h={1}>` child. Call `resolveSceneFromDsl`. Assert that `frame.sceneOverlay` is defined. Assert that the overlay content, when rendered, does not produce the key-prop warning — verified by checking that the React element stored in `sceneOverlay` is the original `TextBox` element (or a Fragment wrapping it), not the unwrapped `<div>`.

Concretely: `frame.sceneOverlay` should be a React element whose `type` is `React.Fragment` (after Fix 2 is applied). The Fragment's children should include an element whose `type` is `TextBox` and whose `key` is `'.$tb1'` (the `Children.toArray`-prefixed form of `'tb1'`).

### Test 2 — Multiple TextBox elements each carry distinct keys

Construct a `<Scene id="test">` with two `<TextBox>` children (`id="tb1"`, `id="tb2"`). Verify that the overlay Fragment contains two children with distinct keys.

### Test 3 — Mixed DSL + TextBox children compile correctly

Construct a `<Scene id="test">` with a `<Camera>` child (registered DSL) and a `<TextBox>` child. Assert that `frame.widgets` contains the camera state, and `frame.sceneOverlay` contains only the `TextBox` element (not the Camera).

### Test 4 — HTML-only direct children (divs) still appear in overlay

Construct a `<Scene id="test">` with a direct `<div>` child (string type). Verify it appears in the overlay. `div` elements come from the `typeof childEl.type === 'string'` branch (line 154) which is unaffected by this change.

### Test file
All tests use real `resolveSceneFromDsl` with real registry state. No mocks. Each test calls `ensureSceneRegistry()` before running. Tests import `TextBox` from `'../elements/text-box'` directly to construct the JSX and to identify it in assertions.

---

## Non-Issues (Ruled Out)

- **`EngineOverlayHost` itself** is not the source. It renders `{overlay}` which is a single `ReactNode` expression. React does not require keys on a single node rendered as a JSX expression child — only on nodes that are sibling members of a JavaScript array or iterable. The issue is that `overlay` _is_ a `ReactNode[]` array (stored without wrapping), making React treat it as a list during reconciliation.
- **The call site** (`scene_hero.tsx` and similar) is not the bug. Authors correctly place `id` props on their `<TextBox>` elements. The `id` prop is not a `key` prop — they are distinct in React — but the author cannot provide a `key` via prop drilling; `key` must be placed on the JSX element at the usage site. The `key` that `Children.toArray` assigns from the `id`-derived key is stripped by `expandNode`.
- **The `EngineOverlayHost.__tests__` test** in the git status (`M packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`) should be reviewed to ensure it does not rely on the current unwrapping behavior.
