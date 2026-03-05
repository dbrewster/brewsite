import type { ReactElement } from 'react';
import { Section, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function TimelinePage(): ReactElement {
  return (
    <Section<SectionId> id="timeline" title="Timeline & Math">
      <p>
        The timeline module defines the algebra for scene frames, tick counts, and progress
        mapping. The math module provides vector and color utilities used by the compiler and
        widget render layer. Both are exported from <code>@brewsite/core</code>.
      </p>

      <h2><code>SceneTimeline</code> Type</h2>
      <CodeBlock
        language="typescript"
        code={`interface SceneTimeline {
  framesPerTick: number;  // animation frames between sampled ticks
  ticksPerScene: number;  // number of ticks to bake per scene transition
  sceneCount: number;     // total number of scenes
  // Derived:
  totalTicks: number;     // ticksPerScene * sceneCount
}`}
      />

      <h2><code>createSceneTimeline(sceneCount, options?)</code></h2>
      <CodeBlock
        language="typescript"
        code={`import { createSceneTimeline } from '@brewsite/core';

// Balanced quality (default)
const timeline = createSceneTimeline(3);

// High quality — more ticks means smoother easing curves
const highQuality = createSceneTimeline(3, {
  framesPerTick: 60,
  ticksPerScene: 60,
});

// Performance mode — fewer ticks, smaller footprint
const perf = createSceneTimeline(3, {
  framesPerTick: 120,
  ticksPerScene: 15,
});`}
      />

      <PropTable
        rows={[
          {
            name: 'framesPerTick',
            type: 'number',
            defaultValue: '60',
            description: 'Number of animation frames between sampled ticks.',
          },
          {
            name: 'ticksPerScene',
            type: 'number',
            defaultValue: '30',
            description: 'Number of pre-baked ticks per scene transition.',
          },
        ]}
      />

      <Callout type="note">
        In most cases you don't need to call <code>createSceneTimeline</code> directly.{' '}
        <code>ScenePlayer</code> creates one internally using the <code>quality</code> prop.
      </Callout>

      <h2>Math Utilities</h2>

      <h3><code>blendNumber(a, b, t)</code></h3>
      <p>Linear interpolation between two numbers.</p>

      <h3><code>blendColor(a, b, t)</code></h3>
      <p>CSS color string interpolation through the LAB color space.</p>

      <h3><code>blendOpacity(a, b, t)</code></h3>
      <p>Opacity interpolation, clamped to [0, 1].</p>

      <h3><code>blendVec3(a, b, t)</code></h3>
      <p>Three.js <code>Vector3</code> linear interpolation. Returns a new <code>Vector3</code>.</p>

      <CodeBlock
        language="typescript"
        code={`import { blendNumber, blendColor, blendOpacity, blendVec3 } from '@brewsite/core';
import * as THREE from 'three';

const mid = blendNumber(0, 100, 0.5);   // → 50
const color = blendColor('#ff6600', '#0066ff', 0.5);  // → LAB midpoint
const opacity = blendOpacity(0, 1, 0.75);  // → 0.75
const posA = new THREE.Vector3(0, 0, 5);
const posB = new THREE.Vector3(0, 2, -3);
const pos  = blendVec3(posA, posB, 0.5);   // → (0, 1, 1)`}
      />

      <h2>Easing</h2>
      <p>
        The blend helpers perform linear interpolation. To apply easing, pre-process the{' '}
        <code>t</code> value before passing it to a blend function:
      </p>
      <CodeBlock
        language="typescript"
        code={`function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const mySpec: ElementTransitionSpec<MyState> = {
  position: {
    blend: (a, b, t) => blendVec3(a, b, easeInOut(t)),
    default: DEFAULT_POSITION,
  },
};`}
      />
    </Section>
  );
}
