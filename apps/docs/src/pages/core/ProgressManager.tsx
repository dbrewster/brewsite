import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function ProgressManager(): JSX.Element {
  return (
    <section>
      <h1>ProgressManager</h1>

      <p>
        <code>{'<ProgressManager>'}</code> is a DSL child element inside <code>{'<Scene>'}</code>{' '}
        that controls two things: how much of the total scroll budget this scene consumes, and how
        the scene's internal progress value advances as the user scrolls through it.
      </p>

      <p>
        Without <code>ProgressManager</code>, every scene gets an equal share of the scroll budget
        and advances linearly. With it, you can give a long content scene six times the scroll
        real estate of a short cinematic scene, and shape the pacing so the scene animates in
        quickly then dwells on the final pose.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="installation">
  <ProgressManager scrollUnits={2400} fn={(t) => Math.min(1, t * 4)} />
  <Camera type="world" position={[0, 2, 8]} />
</Scene>`}
      />

      <h2>Props</h2>

      <PropTable
        rows={[
          {
            name: 'scrollUnits',
            type: 'number',
            required: false,
            defaultValue: '1',
            description:
              'Proportional scroll budget for this scene. A scene with scrollUnits={2400} gets 6× the scroll real estate of one with scrollUnits={400}. The absolute pixel distance each unit maps to is determined by the pixelsPerScene setting on ScenePlayer.',
          },
          {
            name: 'fn',
            type: '(localT: number) => number',
            required: false,
            defaultValue: 'identity (t => t)',
            description:
              'Pure pacing curve. Input and output are both in [0..1]. Constraints: fn(0) === 0, fn(1) === 1, continuous, monotonically non-decreasing. Violations produce a compile warning.',
          },
        ]}
      />

      <h2>
        <code>scrollUnits</code> — Scroll Weighting
      </h2>

      <p>
        <code>scrollUnits</code> is a relative weight. The scroll driver divides the total scroll
        space proportionally among all scenes according to their <code>scrollUnits</code> values.
        Scenes that do not declare <code>ProgressManager</code> default to{' '}
        <code>scrollUnits={1}</code>.
      </p>

      <CodeBlock
        language="tsx"
        code={`{/*
  Total scroll units: 400 + 400 + 2400 = 3200
  Scene "cinematic-open" gets  400/3200 = 12.5% of scroll space
  Scene "cinematic-close" gets 400/3200 = 12.5% of scroll space
  Scene "content-section" gets 2400/3200 = 75% of scroll space
*/}
<Scene key="cinematic-open">
  <ProgressManager scrollUnits={400} />
  <Camera type="world" position={[0, 3, 12]} />
</Scene>

<Scene key="content-section">
  <ProgressManager scrollUnits={2400} />
  <Camera type="world" position={[0, 1.5, 5]} />
</Scene>

<Scene key="cinematic-close">
  <ProgressManager scrollUnits={400} />
  <Camera type="world" position={[0, 8, 20]} />
</Scene>`}
      />

      <h2>
        <code>fn</code> — Pacing Curve
      </h2>

      <p>
        The <code>fn</code> prop is a pure function that maps the scene's local scroll progress
        (the raw <code>t</code> value from 0 to 1) to the scene's internal progress. This lets you
        reshape how the animated state advances within the scene's scroll window.
      </p>

      <p>
        The function must satisfy three constraints:
      </p>

      <ul>
        <li>
          <strong>Boundary:</strong> <code>fn(0) === 0</code> and <code>fn(1) === 1</code>
        </li>
        <li>
          <strong>Continuous:</strong> no sudden jumps
        </li>
        <li>
          <strong>Monotonically non-decreasing:</strong> the output must never go backward as the
          input increases
        </li>
      </ul>

      <Callout type="warning">
        Violations of these constraints produce a compile warning. The runtime does not enforce
        them at playback time, but a function that decreases or jumps will produce jarring
        animation artifacts.
      </Callout>

      <h2>Dwell Pattern</h2>

      <p>
        The most common use of <code>fn</code> is the dwell pattern: animate the scene into its
        final state in the first fraction of the scroll window, then hold that pose for the
        remainder so the user can read content or watch the composition.
      </p>

      <CodeBlock
        language="tsx"
        code={`{/*
  fn={(t) => Math.min(1, t * 4)}
  — reaches progress=1 at t=0.25 (first 25% of scroll)
  — clamps at 1 for remaining 75%
  — the scene's 3D animation completes in the first quarter;
    the final pose holds while the user continues scrolling
*/}
<Scene key="installation">
  <ProgressManager
    scrollUnits={2400}
    fn={(t) => Math.min(1, t * 4)}
  />
  <Camera type="world" position={[0, 2, 8]} />
  <div style={{ position: 'absolute', bottom: 48, left: 64 }}>
    <h2 style={{ color: '#fff' }}>Step 1: Install</h2>
    <pre style={{ color: '#aaa' }}>npm install @brewsite/core</pre>
  </div>
</Scene>`}
      />

      <p>Other useful pacing shapes:</p>

      <CodeBlock
        language="tsx"
        code={`{/* Ease-in: slow start, fast finish */}
fn={(t) => t * t}

{/* Ease-out: fast start, slow finish */}
fn={(t) => 1 - (1 - t) * (1 - t)}

{/* Animate first half, hold second half (50% dwell) */}
fn={(t) => Math.min(1, t * 2)}

{/* Skip directly to final state — instantaneous snap */}
fn={(t) => t > 0 ? 1 : 0}
// Note: this violates the continuity constraint and will produce a warning`}
      />

      <h2>Merge (Carry-Forward) Semantics</h2>

      <p>
        <code>ProgressManager</code> follows the same carry-forward semantics as{' '}
        <code>{'<InputController>'}</code>. If a scene does not declare{' '}
        <code>ProgressManager</code>, the previous scene's <code>scrollUnits</code> and{' '}
        <code>fn</code> carry forward together as a unit. Both props are inherited together — you
        cannot carry forward <code>scrollUnits</code> from one scene while overriding only{' '}
        <code>fn</code> from a different scene.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="a">
  {/* No ProgressManager — defaults: scrollUnits=1, fn=identity */}
  <Camera type="world" position={[0, 2, 8]} />
</Scene>

<Scene key="b">
  <ProgressManager scrollUnits={2000} fn={(t) => Math.min(1, t * 3)} />
  <Camera type="world" position={[3, 1, 6]} />
</Scene>

<Scene key="c">
  {/*
    No ProgressManager — carries forward from scene "b":
    scrollUnits=2000, fn=(t) => Math.min(1, t * 3)
  */}
  <Camera type="world" position={[-2, 1, 6]} />
</Scene>

<Scene key="d">
  {/* Reset to defaults */}
  <ProgressManager scrollUnits={1} />
  <Camera type="world" position={[0, 3, 10]} />
</Scene>`}
      />

      <h2>Compile Warnings</h2>

      <p>
        The compiler emits warnings in two cases:
      </p>

      <ul>
        <li>
          <strong>Last-scene declaration:</strong> declaring <code>ProgressManager</code> on the
          final scene has no effect — there is no scroll space allocated after the last scene. The
          compiler warns and ignores it.
        </li>
        <li>
          <strong>fn constraint violations:</strong> if the compiler can detect that{' '}
          <code>fn(0) !== 0</code>, <code>fn(1) !== 1</code>, or that the function decreases on a
          sample set, it emits a warning. Complex expressions may not be statically detectable; the
          runtime does not re-check.
        </li>
      </ul>

      <Callout type="note">
        Compile warnings are surfaced through the <code>onCompileWarning</code> prop on{' '}
        <code>ScenePlayer</code> or <code>EngineProvider</code>. See{' '}
        <Link to="/core/player">ScenePlayer &amp; EngineProvider</Link> for details.
      </Callout>
    </section>
  );
}
