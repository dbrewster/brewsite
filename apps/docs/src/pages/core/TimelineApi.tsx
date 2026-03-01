import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function TimelineApi(): JSX.Element {
  return (
    <section>
      <h1>Timeline &amp; Math</h1>

      <p>
        The timeline module defines the algebra for scene frames, tick counts, and progress
        mapping. The math module provides vector and color utilities used by the compiler and
        widget render layer. Both are exported from <code>@brewsite/core</code> and are safe
        to use in your own widgets and custom blend specs.
      </p>

      <h2><code>SceneTimeline</code> Type</h2>

      <p>
        A <code>SceneTimeline</code> describes the quantization of scene playback into discrete
        ticks. The compiler uses it to determine how many baked frames to generate per scene pair.
        Higher tick counts produce smoother transitions at the cost of a larger precomputed track.
      </p>

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

      <p>
        The factory function for building a <code>SceneTimeline</code>. Pass the total number of
        scenes and an optional options object. The defaults correspond to the{' '}
        <code>'balanced'</code> quality preset, which produces smooth 60fps transitions for most
        scenes:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { createSceneTimeline } from '@brewsite/core';

// Balanced quality (default)
const timeline = createSceneTimeline(3);

// High quality — more ticks means smoother easing curves at the cost of
// a larger SceneTrack in memory
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
            description:
              'Number of animation frames between sampled ticks. Higher values reduce how often the engine samples the SceneTrack per second, which reduces CPU work in exchange for less precise easing curve resolution.',
          },
          {
            name: 'ticksPerScene',
            type: 'number',
            defaultValue: '30',
            description:
              'Number of pre-baked ticks per scene transition. More ticks = smoother interpolation curves = larger SceneTrack. 30 is a solid default for most marketing scenes.',
          },
        ]}
      />

      <Callout type="note">
        In most cases you don't need to call <code>createSceneTimeline</code> directly.{' '}
        <code>ScenePlayer</code> creates one internally using the <code>quality</code> prop.
        Use this function only if you're building a custom driver or need programmatic timeline
        control.
      </Callout>

      <h2>Math Utilities</h2>

      <p>
        These blend helpers are the building blocks of custom transition specs. Each takes two
        source values and a progress value <code>t</code> in [0, 1] and returns the interpolated
        result.
      </p>

      <h3><code>blendNumber(a, b, t)</code></h3>
      <p>
        Linear interpolation between two numbers. The simplest blend: result equals{' '}
        <code>a + (b - a) * t</code>.
      </p>

      <h3><code>blendColor(a, b, t)</code></h3>
      <p>
        CSS color string interpolation through the LAB color space. LAB interpolation preserves
        perceptual brightness and hue consistency better than RGB lerp — you won't see muddy
        grays when blending from blue to orange.
      </p>

      <h3><code>blendOpacity(a, b, t)</code></h3>
      <p>
        Opacity interpolation, clamped to [0, 1]. Equivalent to{' '}
        <code>Math.max(0, Math.min(1, blendNumber(a, b, t)))</code>, but with the clamp baked in
        for safety.
      </p>

      <h3><code>blendVec3(a, b, t)</code></h3>
      <p>
        Three.js <code>Vector3</code> linear interpolation. Returns a new <code>Vector3</code>{' '}
        — it does not mutate the input vectors.
      </p>

      <CodeBlock
        language="typescript"
        code={`import { blendNumber, blendColor, blendOpacity, blendVec3 } from '@brewsite/core';
import * as THREE from 'three';

// Simple number interpolation
const mid = blendNumber(0, 100, 0.5);   // → 50

// Perceptually correct color blend
const color = blendColor('#ff6600', '#0066ff', 0.5);  // → LAB midpoint

// Clamped opacity
const opacity = blendOpacity(0, 1, 0.75);  // → 0.75

// Vector3 blend
const posA = new THREE.Vector3(0, 0, 5);
const posB = new THREE.Vector3(0, 2, -3);
const pos  = blendVec3(posA, posB, 0.5);   // → (0, 1, 1)`}
      />

      <Callout type="note">
        These blend helpers are used internally by the compiler's <code>ElementTransitionSpec</code>.
        You use them when authoring custom transition specs in your element's{' '}
        <code>compile.ts</code> file. They have no Three.js dependencies (except{' '}
        <code>blendVec3</code>) and are safe to use in the compiler layer.
      </Callout>

      <h2>Easing</h2>

      <p>
        The blend helpers perform linear interpolation. To apply easing, pre-process the{' '}
        <code>t</code> value before passing it to a blend function:
      </p>

      <CodeBlock
        language="typescript"
        code={`// Ease-in-out cubic applied before blending
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const mySpec: ElementTransitionSpec<MyState> = {
  position: {
    blend: (a, b, t) => blendVec3(a, b, easeInOut(t)),
    default: DEFAULT_POSITION,
  },
};`}
      />

      <p>
        The easing is applied at compile time — the pre-baked ticks in the{' '}
        <code>SceneTrack</code> already incorporate the eased values, so there is zero easing
        math at playback time.
      </p>
    </section>
  );
}
