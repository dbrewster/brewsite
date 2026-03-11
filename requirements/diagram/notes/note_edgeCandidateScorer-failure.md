---
title: "Known Failure: edgeCandidateScorer retreating overshoot penalty test"
doc_type: note
owner: Toolkit Product
status: active
updated: 2026-03-10
---

# Known Failure: `edgeCandidateScorer.test.ts`

## Summary

One test in `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidateScorer.test.ts` fails and is tracked as pre-existing technical debt. This failure predates the 2026-03-10 module architecture redesign and is unrelated to it.

## Failing Test

**File:** `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidateScorer.test.ts`

**Test name:** `"retreating route has higher overshoot penalty"`

**Nature of failure:** The test asserts that a retreating route (one that moves away from the target before approaching it) receives a higher overshoot penalty than a direct route. The scorer currently does not weight retreating routes sufficiently to satisfy the assertion threshold.

## Impact

- This is a test-only failure. The edge routing system produces visually acceptable output in production scenes; the overshoot penalty is applied but is calibrated too leniently.
- Edges that take retreating paths may appear slightly longer or less direct than ideal when obstacle avoidance forces a backward detour, but they are not visually broken.

## Disposition

- **Do not suppress or skip** this test. It documents a known calibration gap in the scorer.
- The fix requires adjusting the overshoot penalty weight in `edgeCandidateScorer.ts`. Any change must not regress the other passing scorer tests.
- This work should be scheduled as a dedicated routing quality improvement ticket rather than a hotfix.

## Related Files

- `packages/diagram/src/elements/diagram/compiler/edgeCandidateScorer.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidateScorer.test.ts`
