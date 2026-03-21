---
title: Speaker Notes
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## Authoring Speaker Notes

Add speaker notes to a slide using the `notes` prop on `<Slide>`. Notes are plain text strings stored in the engine's `VariableStore` at compile time.

```tsx
import { Slide, TitleSlide, ContentSlide, Body } from '@brewsite/slides';

<Slide key="intro" notes="Welcome the audience. Introduce the team and set expectations for the session.">
  <TitleSlide title="Welcome" subtitle="Q4 Business Review" />
</Slide>

<Slide key="revenue" notes="Highlight 18% YoY growth. Call out enterprise segment as primary driver.">
  <ContentSlide title="Revenue">
    <Body>$12.4M in Q4 revenue, up 18% year-over-year.</Body>
  </ContentSlide>
</Slide>
```

Notes are optional. When the `notes` prop is omitted or `undefined`, no notes are stored for that slide.

---

## Reading Notes with useSlideNotes

The `useSlideNotes` hook reads the speaker notes for a specific slide by its key. It returns `string | undefined` -- the notes text if authored, or `undefined` if no notes exist for that slide.

```ts
import { useSlideNotes } from '@brewsite/slides';

function useSlideNotes(slideKey: string): string | undefined;
```

The hook must be called inside a `SceneEngine` context. It reactively subscribes to the `VariableStore` and re-renders when the notes value changes.

```tsx
import { useSlideNotes } from '@brewsite/slides';

function NotesDisplay({ slideKey }: { slideKey: string }) {
  const notes = useSlideNotes(slideKey);
  if (!notes) return null;
  return (
    <div style={{ padding: 16, color: 'var(--brewsite-text-secondary)' }}>
      {notes}
    </div>
  );
}
```

---

## How Notes Are Stored

`SlideMetaWidget` publishes notes to the `VariableStore` under the namespace `slide:meta` (constant `SLIDE_META_NAMESPACE`). Each slide's notes are stored with the key pattern `{slideKey}.notes`.

The storage path for a slide with key `"revenue"` is:
- Namespace: `slide:meta`
- Key: `revenue.notes`

`useSlideNotes` internally calls `useVariable(SLIDE_META_NAMESPACE, \`${slideKey}.notes\`)` and returns the value only if it is a string.

Notes are written to the `VariableStore` by `SlideMetaWidget.apply()` on each frame tick. They are available as soon as the slide's Scene is compiled and the widget is initialized.

---

## Building a Custom Presenter View

Build a custom presenter view by combining `useSlideNotes` with `useSlideNavigation` to read notes for the current slide and provide navigation controls:

```tsx
import { useSlideNotes, useSlideNavigation } from '@brewsite/slides';
import type { SlideNavigationState } from '@brewsite/slides';

type PresenterPanelProps = {
  slideKeys: string[];
  totalSlides: number;
  scrollUnits: number[];
};

function PresenterPanel({ slideKeys, totalSlides, scrollUnits }: PresenterPanelProps) {
  const nav = useSlideNavigation(totalSlides, scrollUnits);
  const currentKey = slideKeys[nav.current] ?? '';
  const notes = useSlideNotes(currentKey);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, color: 'var(--brewsite-text-primary)' }}>
        Slide {nav.current + 1} of {nav.total}: {currentKey}
      </div>
      <div style={{
        padding: 16,
        background: 'var(--brewsite-surface-secondary)',
        borderRadius: 8,
        color: 'var(--brewsite-text-secondary)',
        minHeight: 80,
        fontFamily: 'var(--brewsite-font-family)',
        fontSize: 'var(--brewsite-font-size-body)',
        whiteSpace: 'pre-wrap',
      }}>
        {notes ?? 'No speaker notes for this slide.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={nav.prev}>Previous</button>
        <button onClick={nav.next}>Next</button>
      </div>
    </div>
  );
}
```

This component must be rendered inside the `SceneEngine` context, either alongside `SlidePlayer` or in a separate window that shares the same engine instance.

---

## PresenterView Status

A `PresenterView` component is implemented internally in the `@brewsite/slides` package but is not exported from the package barrel (`index.ts`). It is not part of the public API.

For presenter view functionality, use the `useSlideNotes` hook to read notes and build a custom presenter panel as shown above. The `SlidePlayerHandle` imperative API provides `goTo()`, `next()`, and `prev()` for navigation control from outside the engine context.
