import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';

export default function Concepts(): JSX.Element {
  return (
    <section>
      <h1>Widget SDK</h1>

      <p>
        Every renderable concept in BrewSite is a widget. The <code>Camera</code>,{' '}
        <code>Lighting</code>, <code>Background</code>, <code>Model</code>, and <code>Floor</code>{' '}
        elements are all widgets. The Widget SDK lets you build your own using the same interfaces.
      </p>

      <h2>IWidget Interface Hierarchy</h2>

      <p>
        All widgets implement <code>IWidget</code> as their base, then opt into additional
        capabilities by implementing the relevant sub-interfaces. You only implement what your
        widget needs.
      </p>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Interface</th>
            <th>Extends</th>
            <th>Purpose</th>
            <th>Key Members</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>IWidget</code></td>
            <td>—</td>
            <td>Base interface for all widgets</td>
            <td><code>widgetId</code>, <code>initialize(ctx)</code>, <code>dispose(ctx)</code></td>
          </tr>
          <tr>
            <td><code>ISceneElement</code></td>
            <td>IWidget</td>
            <td>Compiles from DSL nodes</td>
            <td><code>compileNode(node)</code>, <code>buildTransitionSpec()</code></td>
          </tr>
          <tr>
            <td><code>IRenderable</code></td>
            <td>IWidget</td>
            <td>Renders to Three.js scene</td>
            <td><code>apply(state, ctx)</code></td>
          </tr>
          <tr>
            <td><code>ILoadable</code></td>
            <td>IWidget</td>
            <td>Async asset loading</td>
            <td><code>load(ctx)</code>, <code>assetsReady</code></td>
          </tr>
          <tr>
            <td><code>IAnimationController</code></td>
            <td>IWidget</td>
            <td>Per-frame animation updates</td>
            <td><code>onTick(ctx: AnimationTickContext)</code></td>
          </tr>
          <tr>
            <td><code>IVariableProvider</code></td>
            <td>IWidget</td>
            <td>Publishes to VariableStore</td>
            <td><code>getVariables()</code></td>
          </tr>
          <tr>
            <td><code>IDslComposite</code></td>
            <td>IWidget</td>
            <td>Handles nested DSL nodes</td>
            <td><code>CUSTOM_NODE_HANDLER</code></td>
          </tr>
          <tr>
            <td><code>IContainedModel</code></td>
            <td>IWidget</td>
            <td>
              Attaches to a parent model{' '}
              <em>
                (<code>IContainedModel</code> is specific to <code>@brewsite/model</code> and will
                be documented there. It extends <code>IRenderable</code> to support parenting to
                bone attachment points.)
              </em>
            </td>
            <td><code>anchorModelId</code>, <code>anchorKey</code></td>
          </tr>
        </tbody>
      </table>

      <h2>Widget Lifecycle</h2>

      <p>Widgets go through these phases during the engine lifecycle:</p>

      <ol>
        <li>
          <strong>Register</strong> — The widget is added to the <code>WidgetRegistry</code> before
          the player mounts. This is where you call <code>registry.register(new MyWidget())</code>.
        </li>
        <li>
          <strong>Compile</strong> — If the widget implements <code>ISceneElement</code>, the
          compiler calls <code>compileNode(node)</code> for each matching DSL node and{' '}
          <code>buildTransitionSpec()</code> to get the blend spec. The result is baked into the{' '}
          <code>SceneTrack</code>.
        </li>
        <li>
          <strong>Initialize</strong> — <code>initialize(ctx)</code> is called once when the player
          mounts. This is where you create Three.js objects and add them to the scene.
        </li>
        <li>
          <strong>Load</strong> — If the widget implements <code>ILoadable</code>,{' '}
          <code>load(ctx)</code> is called asynchronously. The player waits for all loadable widgets
          to set <code>assetsReady = true</code> before beginning playback.
        </li>
        <li>
          <strong>Tick</strong> — If the widget implements <code>IAnimationController</code>,{' '}
          <code>onTick(ctx)</code> is called every animation frame with an{' '}
          <code>AnimationTickContext</code>. Use this for physics simulation, procedural motion, or
          publishing variable updates.
        </li>
        <li>
          <strong>Apply</strong> — If the widget implements <code>IRenderable</code>,{' '}
          <code>apply(state, ctx)</code> is called every frame with the current pre-baked state
          sampled from the <code>SceneTrack</code>. This is where you apply state to Three.js
          objects.
        </li>
        <li>
          <strong>Dispose</strong> — <code>dispose(ctx)</code> is called when the player unmounts.
          Remove Three.js objects, cancel pending requests, and release GPU resources here.
        </li>
      </ol>

      <h2>Type Guards</h2>

      <p>
        The SDK ships type-guard functions for each interface. Use them when you have a reference
        to an <code>IWidget</code> and need to check which capabilities it has:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { isSceneElement, isRenderable, isLoadable } from '@brewsite/core';

if (isRenderable(widget)) {
  widget.apply(state, ctx);
}

if (isLoadable(widget)) {
  await widget.load(ctx);
}

if (isSceneElement(widget)) {
  const spec = widget.buildTransitionSpec();
}`}
      />

      <Callout type="tip">
        You only need to implement the interfaces your widget uses. A simple overlay widget might
        only need <code>IWidget</code> + <code>ISceneElement</code>. A fully animated model widget
        would implement <code>ISceneElement</code> + <code>IRenderable</code> +{' '}
        <code>ILoadable</code> + <code>IAnimationController</code>.
      </Callout>

      <h2>Context Types</h2>

      <p>
        The runtime passes context objects into your widget methods each frame. Two context shapes
        appear across the widget interfaces: <code>AnimationTickContext</code> (received by{' '}
        <code>IAnimationController.onTick()</code>) and <code>WidgetRenderContext</code> (received
        by <code>IRenderable.apply()</code>).
      </p>

      <CodeBlock
        language="typescript"
        code={`// AnimationTickContext — received by IAnimationController.onTick()
type AnimationTickContext = {
  clock: RealtimeClock;          // real-time, synchronized, unaffected by scroll
  effectiveDeltaSeconds: number; // scroll-boosted; use for AnimationMixer.update()
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
};

type RealtimeClock = {
  wallTimeSeconds: number; // absolute time since page load; use for oscillations
  deltaSeconds: number;    // real-time frame delta (~0.0167s at 60fps)
};`}
      />

      <p>
        <code>WidgetRenderContext</code> follows the same clock shape — the flat{' '}
        <code>deltaSeconds</code> and <code>wallTimeSeconds</code> fields are replaced by a{' '}
        <code>clock: RealtimeClock</code> sub-object alongside{' '}
        <code>effectiveDeltaSeconds</code>.
      </p>

      <h3>Widget Time Contract</h3>

      <p>
        Both context types expose three time-related fields. Choose the right one for your use
        case:
      </p>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>When to use</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>clock.wallTimeSeconds</code></td>
            <td>Ambient oscillations, procedural animations</td>
            <td><code>{'Math.sin(clock.wallTimeSeconds * 2)'}</code></td>
          </tr>
          <tr>
            <td><code>clock.deltaSeconds</code></td>
            <td>Physics, smooth increments</td>
            <td><code>{'velocity += force * clock.deltaSeconds'}</code></td>
          </tr>
          <tr>
            <td><code>effectiveDeltaSeconds</code></td>
            <td>GLTF AnimationMixer, camera controls</td>
            <td><code>{'mixer.update(ctx.effectiveDeltaSeconds)'}</code></td>
          </tr>
        </tbody>
      </table>

      <Callout type="warning">
        Never use <code>{'this.localTime += deltaSeconds'}</code> in a widget. It drifts between
        widgets (different start times) and backlogs when a browser tab is hidden then shown. Use{' '}
        <code>clock.wallTimeSeconds</code> for phase-coherent oscillations — it is absolute and
        always correct.
      </Callout>

      <Callout type="note">
        <code>effectiveDeltaSeconds</code> equals <code>clock.deltaSeconds</code> when the user is
        idle. When the scene has <code>animationTimeScale</code> declared and the user scrolls, it
        increases proportionally — GLTF animations accelerate with scroll speed. At rest,
        everything plays at real-time.
      </Callout>

      <p>
        Ready to build? See{' '}
        <Link to="/core/custom-widget">Creating a Custom Widget</Link> for a complete step-by-step
        walkthrough, or read about the{' '}
        <Link to="/core/variable-store">VariableStore</Link> for cross-widget state sharing.
      </p>
    </section>
  );
}
