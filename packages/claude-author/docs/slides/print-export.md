---
title: Print and Export
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## captureSlideSnapshots

`captureSlideSnapshots()` is an imperative method on `SlidePlayerHandle`. It sequentially seeks the engine to each slide, waits for the Three.js renderer to complete two animation frames, and captures the WebGL canvas as a PNG data URL. After capturing all slides, it restores the engine to the original slide position.

```ts
captureSlideSnapshots(): Promise<Map<string, string>>
```

Returns a `Promise<Map<string, string>>` where each key is the slide's `key` prop (the Scene id) and each value is a PNG data URL string (`data:image/png;base64,...`).

The method is async and must be awaited before using the snapshots. It uses `requestAnimationFrame` double-buffering to ensure the WebGL canvas has fully rendered each slide before capture.

---

## Using captureSlideSnapshots

Access `captureSlideSnapshots` via a ref to `SlidePlayer`:

```tsx
import { useRef } from 'react';
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, Body, slidesPlugin,
} from '@brewsite/slides';
import type { SlidePlayerHandle } from '@brewsite/slides';

function PrintableDeck() {
  const ref = useRef<SlidePlayerHandle>(null);

  async function handleExport() {
    const snapshots = await ref.current!.captureSlideSnapshots();
    // snapshots is Map<slideKey, dataURL>
    // Example: snapshots.get('intro') => 'data:image/png;base64,...'

    // Open a print window with snapshot images
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write('<html><body style="margin:0;">');
    for (const [key, dataUrl] of snapshots) {
      printWindow.document.write(
        `<div style="page-break-after: always;">
          <img src="${dataUrl}" style="width: 100%; height: auto;" alt="Slide: ${key}" />
        </div>`
      );
    }
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <>
      <button onClick={handleExport}>Export to PDF</button>
      <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
        <SlidePlayer ref={ref}>
          <Slide key="intro"><TitleSlide title="Welcome" /></Slide>
          <Slide key="content"><ContentSlide title="Overview"><Body>Details.</Body></ContentSlide></Slide>
          <Slide key="close"><TitleSlide title="Thank You" /></Slide>
        </SlidePlayer>
      </SceneEngine>
    </>
  );
}
```

The capture process temporarily changes the engine progress to visit each slide, then restores the original progress afterward. During capture, the slide transitions are visible in the player. For a seamless user experience, consider showing a loading indicator during the async operation.

---

## PrintOptions Type

The `PrintOptions` type is defined for forward compatibility with the planned `SlidePrintLayout` component:

```ts
import type { PrintOptions } from '@brewsite/slides';

type PrintOptions = {
  /** Page size for @page CSS rule. Default: '16x9' (16in x 9in landscape). */
  pageSize: 'letter' | 'a4' | '16x9';
  /** When true, renders speaker notes below each slide. Default: false. */
  includeNotes: boolean;
};
```

This type is exported from `@brewsite/slides` and can be used in custom print layout implementations. The `pageSize` field maps to CSS `@page` size rules. The `includeNotes` field controls whether speaker notes (from the `notes` prop on `<Slide>`) appear below each slide in the print output.

---

## SlidePrintLayout Status

`SlidePrintLayout` is implemented internally in the `@brewsite/slides` package but is not exported from the package barrel. It is not part of the public API.

Build custom print layouts using `captureSlideSnapshots()` for canvas snapshots and `useSlideNotes()` for speaker notes. Combine them in a print-specific component:

```tsx
import { useRef, useState } from 'react';
import type { SlidePlayerHandle } from '@brewsite/slides';
import { useSlideNotes } from '@brewsite/slides';

function PrintLayout({ slideKeys, snapshots }: {
  slideKeys: string[];
  snapshots: Map<string, string>;
}) {
  return (
    <div style={{ display: 'none' }} className="print-only">
      {slideKeys.map((key) => (
        <div key={key} style={{ pageBreakAfter: 'always' }}>
          <img src={snapshots.get(key)} alt={key} style={{ width: '100%' }} />
          <NoteBlock slideKey={key} />
        </div>
      ))}
    </div>
  );
}

function NoteBlock({ slideKey }: { slideKey: string }) {
  const notes = useSlideNotes(slideKey);
  if (!notes) return null;
  return (
    <div style={{ padding: 16, borderTop: '1px solid #ccc', fontSize: 14, color: '#333' }}>
      {notes}
    </div>
  );
}
```

---

## SlidePlayerHandle Full Interface

The complete imperative API exposed by `SlidePlayer` via `React.forwardRef`:

```ts
import type { SlidePlayerHandle } from '@brewsite/slides';

interface SlidePlayerHandle {
  /** Navigate to the slide at the given 0-based logical index. */
  goTo(index: number): void;
  /** Navigate to the next logical slide. No-ops on the last slide. */
  next(): void;
  /** Navigate to the previous logical slide. No-ops on the first slide. */
  prev(): void;
  /**
   * Seeks the engine to each slide sequentially, captures the WebGL canvas
   * as a PNG data URL, then restores the original slide.
   *
   * Must be awaited before calling window.print().
   *
   * @returns Map from slideKey (= Scene id) to PNG data URL string.
   */
  captureSlideSnapshots(): Promise<Map<string, string>>;
}
```

Usage with `useRef`:

```tsx
import { useRef } from 'react';
import type { SlidePlayerHandle } from '@brewsite/slides';

const playerRef = useRef<SlidePlayerHandle>(null);

// Later:
playerRef.current?.goTo(2);     // Jump to third slide
playerRef.current?.next();       // Advance one slide
playerRef.current?.prev();       // Go back one slide

const snapshots = await playerRef.current?.captureSlideSnapshots();
// snapshots: Map<string, string> | undefined
```
