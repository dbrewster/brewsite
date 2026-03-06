// apps/examples/src/slides-demo/SlidesDemoPage.tsx
// Demo page for @brewsite/slides — renders a full-viewport SlidePlayer
// with dots progress indicator, keyboard navigation, and all 5 layout variants.

import type { JSX } from 'react';
import { SlidePlayer } from '@brewsite/slides';
import { demoSlides } from './deck';

export default function SlidesDemoPage(): JSX.Element {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0f14' }}>
      <SlidePlayer
        progressIndicator="dots"
        transition="dissolve"
        aspectRatio={16 / 9}
        navigation={{ keyboard: true, touch: true, pointer: true }}
      >
        {demoSlides}
      </SlidePlayer>
    </div>
  );
}
