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
            <td><code>onTick(dt, variables)</code></td>
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
            <td>Attaches to a parent model</td>
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
          <code>onTick(dt, variables)</code> is called every animation frame. Use this for physics
          simulation, procedural motion, or publishing variable updates.
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

      <p>
        Ready to build? See{' '}
        <Link to="/core/custom-widget">Creating a Custom Widget</Link> for a complete step-by-step
        walkthrough, or read about the{' '}
        <Link to="/core/variable-store">VariableStore</Link> for cross-widget state sharing.
      </p>
    </section>
  );
}
