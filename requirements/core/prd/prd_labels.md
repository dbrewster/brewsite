---
title: "BrewSite Core — 3D Label System"
doc_type: prd
status: moved
owner: Toolkit Product
last_updated: 2026-03-13
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full 3D label system for @brewsite/core: DSL authoring surface, compiled primitives, LabelPositioner screen projection pipeline, LabelItem renderer, LabelPositionerContext, and transition behavior."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Added LabelStyle.fontFamily optional field for per-label font override. Documented CSS variable inheritance path from EngineOverlayHost --brewsite-font-family for the common case (no per-label override needed)."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "NVS system: LabelPositioner.setContainerSize gains optional third parameter nvsBounds?: NVSRect. When provided, label screen-coordinate projection is restricted to the NVS sub-region of the container. ModelWidget implements INVSBounded."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Status changed to 'moved'. The label system has been fully relocated to @brewsite/model. All label types, components, and compiler logic now live in packages/model/src/. This document is retained as a historical reference only. The authoritative PRD is requirements/model/prd/prd_model.md."
---

# BrewSite Core — 3D Label System

> **This feature has moved to `@brewsite/model`.**
>
> The label system — `LabelDefinition`, `LabelResolved`, `LabelStyle`, `LabelItem`, `LabelPositioner`, `LabelPositionerContext`, `useLabelPositioner`, `compileLabels`, and the `<Label>` DSL component — is implemented in `packages/model/src/` and published as part of `@brewsite/model`. It is not part of `@brewsite/core`.
>
> **The authoritative PRD is:** `requirements/model/prd/prd_model.md`
>
> All implementation details, API design, and launch criteria documented below were accurate at the time of the initial design but reflect an earlier architecture where labels were planned for `@brewsite/core`. The implementation was placed in `@brewsite/model` from the start to keep the core bundle lean.

---

## Current Package Location

| Symbol | Package | File |
|--------|---------|------|
| `LabelDefinition`, `LabelResolved`, `LabelStyle`, `LabelColor` | `@brewsite/model` | `packages/model/src/labels/types.ts` |
| `LabelItem` | `@brewsite/model` | `packages/model/src/labels/LabelItem.tsx` |
| `LabelPositioner` | `@brewsite/model` | `packages/model/src/player/LabelPositioner.ts` |
| `LabelPositionerContext`, `useLabelPositioner` | `@brewsite/model` | `packages/model/src/player/LabelPositionerContext.ts` |
| `compileLabels`, `LabelCompileContext` | `@brewsite/model` | `packages/model/src/compiler/labelCompiler.ts` |
| `<Label>`, `<Labels>` (DSL stubs) | `@brewsite/model` | `packages/model/src/elements/model/ModelWidget.ts` |
| `LabelProps` | `@brewsite/model` | `packages/model/src/labels/dsl.tsx` |

Import example:

```typescript
import {
  LabelItem,
  LabelPositioner,
  LabelPositionerContext,
  useLabelPositioner,
} from '@brewsite/model';
```

---

## Key Design Changes Since Initial Spec

The following decisions changed between the initial design (documented below) and the final implementation in `@brewsite/model`:

1. **`LabelPositionerContext` value type** — The context provides the `LabelPositioner` class instance directly (not a subscribe-based map). `LabelItem` calls `positioner.registerElement(id, el)` imperatively rather than subscribing to a callback-based API.

2. **`LabelItem` props** — `LabelItem` accepts `{ label: LabelResolved }` (not `{ id: string }`). The full resolved label is passed in directly; no context lookup by ID is performed.

3. **`<Label>` placement rule** — `<Label>` must be nested under `<BodyPart>` or `<Subpart>`, not as a direct child of `<Model>`. This is enforced by a runtime error in the `CUSTOM_NODE_HANDLER`.

4. **`targetPartId` resolution** — `targetPartId` is derived from the parent `<BodyPart id="...">` element's `boneId` or `meshId` prop (with `id` as fallback). Labels under `<Subpart>` use `"${partId}:${subpartId}"` as `targetPartId`.

5. **`LabelStyle.color` type** — Typed as `LabelColor = 'target-color' | (string & {})`, not a plain `string`. The `'target-color'` sentinel causes the label to inherit the resolved color of its target body part from `targetColors` map at runtime.

6. **`LabelStyle.lineLength` removed** — Not present in the final implementation. Connector line length is computed dynamically from the screen-space distance between the bone anchor point and the label position point.

7. **`LabelStyle.fontSize`** — Typed as `number | string`, not `string` only. Number values render as pixels via React's `CSSProperties.fontSize` behavior.

8. **`compileLabels()` signature** — Takes `(fromLabels, toLabels, context)` where `context = { sceneProgress: number }`. Not a per-model-node compiler function.

---

## Historical Specification

The remainder of this document preserves the original specification for historical reference. Do not use it as implementation guidance — use `requirements/model/prd/prd_model.md` instead.

*(Original sections 1–13 omitted to avoid confusion with the current implementation. The current implementation is fully documented in the model PRD.)*
