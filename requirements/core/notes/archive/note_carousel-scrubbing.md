---
title: "Carousel Scrubbing — Extracted from Input Unification Plan"
doc_type: note
owner: architect
status: active
updated: 2026-03-12
---

# Carousel Scrubbing

This feature was extracted from the Input System Unification plan
(`requirements/core/plans/archive/plan_input-unification.md`) as a
follow-on work item.

## Status

The full plan is authored at:
`requirements/core/plans/plan_carousel-scrubbing.md`

## Context

The input unification plan added `carousel.next` / `carousel.prev` to the
`InputActionType` open union as forward declarations, and exposed
`patchWidgetStates()` on `UseSceneEngineResult` and
`setWidgetStatePatches()` on `RuntimeDriverImpl`. The carousel scrubbing
plan builds on these foundations.

## What Was NOT Implemented in Input Unification

- Runtime handler for `carousel.next` / `carousel.prev` actions in
  `ActionInputController`
- `VariableStore`-driven layout re-resolve on carousel step
- `ViewLayoutState` extensions for carousel index state
- Per-frame carousel position interpolation via `patchWidgetStates()`

All of the above are specified in `plan_carousel-scrubbing.md`.
