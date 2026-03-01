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

      <h2>
        <code>autoAdvance</code> — Idle Auto-Advance
      </h2>

      <p>
        When the user is idle (not scrolling), <code>autoAdvance</code> causes time to advance the
        scene automatically at a configurable rate. The scene plays on its own when the page loads;
        the user's scroll always takes over immediately.
      </p>

      <PropTable
        rows={[
          {
            name: 'autoAdvance.duration',
            type: 'number',
            required: true,
            defaultValue: '—',
            description:
              'Seconds for the scene window to fully traverse from 0 to max while idle. This is the primary knob: "play this scene in N seconds while idle."',
          },
          {
            name: 'autoAdvance.max',
            type: 'number',
            required: false,
            defaultValue: '1.0',
            description:
              'Optional ceiling — stop auto-advancing at this fraction of the scene window. Example: max: 0.80 shows the first 80% automatically; the user must scroll for the remaining 20%.',
          },
          {
            name: 'autoAdvance.pauseOnScroll',
            type: 'boolean',
            required: false,
            defaultValue: 'true',
            description:
              'Pauses auto-advance when the user scrolls; resumes after 200ms of scroll inactivity.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`// Hero scene: auto-plays through 80% in 8 seconds while idle.
// User can scroll at any time to take over.
<Scene id="hero">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
  />
</Scene>`}
      />

      <Callout type="note">
        Use <code>autoAdvance</code> to create cinematic idle sequences — the scene plays on its
        own when the user loads the page, but the user's scroll always takes priority immediately.
      </Callout>

      <p>
        The following configurations emit a <code>PROGRESS_MANAGER</code> compile warning via{' '}
        <code>onCompileWarning</code>:
      </p>

      <ul>
        <li>
          <strong>
            <code>autoAdvance.duration {'<='} 0</code>:
          </strong>{' '}
          a non-positive duration is meaningless and will be ignored.
        </li>
        <li>
          <strong>
            <code>max</code> outside <code>(0, 1]</code>:
          </strong>{' '}
          values at or below zero, or above one, are out of range.
        </li>
        <li>
          <strong>
            <code>autoAdvance</code> on the last scene:
          </strong>{' '}
          the last scene has no scroll space allocated after it, so auto-advance has no effect.
        </li>
      </ul>

      <h2>
        <code>animationTimeScale</code> — Animation Time Scale
      </h2>

      <p>
        When progress moves (from scroll or auto-advance), GLTF animation mixers run faster
        proportionally. At idle, animations always play at 1× real-time regardless of this setting.
      </p>

      <p>
        The value represents total animation-seconds that play when scrolling through the scene's
        full window. For example, <code>animationTimeScale={6}</code> means 6 seconds of animation
        play across a full scene scroll.
      </p>

      <p>
        The effective delta is computed as:
      </p>

      <CodeBlock
        language="typescript"
        code={`effectiveDelta = max(realTime, min(deltaProgress × scale, 0.2s cap))`}
      />

      <p>
        This formula ensures animation never pauses — it runs at least at real-time speed even
        when the user scrolls slowly. During fast scrolling, animation accelerates up to the cap.
      </p>

      <PropTable
        rows={[
          {
            name: 'animationTimeScale',
            type: 'number | undefined',
            required: false,
            defaultValue: 'undefined (1× always)',
            description:
              'Total animation-seconds that play when scrolling through the full scene window. When undefined, animations always run at 1× real-time. During auto-advance, deltaProgress is tiny so animation plays at approximately 1× real-time; during fast scroll, animation accelerates.',
          },
        ]}
      />

      <CodeBlock
        language="tsx"
        code={`<Scene id="features">
  <ProgressManager
    scrollUnits={2000}
    animationTimeScale={6}
    // At idle: animations play at 1× real-time
    // During fast scroll: animations run up to 6× faster
  />
  <Robot id="hero-bot">
    <Playback>
      <Animation clipName="walk-cycle" enabled weight={1} />
    </Playback>
  </Robot>
</Scene>`}
      />

      <h2>Combining autoAdvance + animationTimeScale</h2>

      <p>
        <code>autoAdvance</code> and <code>animationTimeScale</code> compose naturally. During
        idle auto-advance, <code>deltaProgress</code> is tiny each frame, so the animation time
        scale formula resolves to approximately 1× real-time. During fast scroll, the animation
        accelerates. Both behaviors work together without any special configuration.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Cinematic hero: auto-plays the animation at real-time while idle,
// then responds to scroll with boosted animation speed.
<Scene id="hero">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
    animationTimeScale={3}
  />
</Scene>`}
      />

      <Callout type="note">
        Both <code>autoAdvance</code> and <code>animationTimeScale</code> are part of the{' '}
        <code>ProgressManagerSpec</code> and carry forward together under the same carry-forward
        semantics as <code>scrollUnits</code> and <code>fn</code>. To explicitly clear
        auto-advance on a later scene, declare{' '}
        <code>{'<ProgressManager autoAdvance={undefined} />'}</code>.
      </Callout>
    </section>
  );
}
