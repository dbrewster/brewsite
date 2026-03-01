import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';

export default function Registry(): JSX.Element {
  return (
    <section>
      <h1>WidgetRegistry</h1>

      <p>
        The <code>WidgetRegistry</code> maps DSL component names to widget instances. You create
        a registry once per <code>ScenePlayer</code> instance and pass it in via the{' '}
        <code>widgetSetup</code> prop. The registry routes each compiled DSL node to the correct
        widget handler during compilation and connects widgets to the runtime engine.
      </p>

      <h2><code>register(widget)</code></h2>

      <p>
        Register a single widget instance. The widget's <code>widgetId</code> becomes the key
        that maps it to matching DSL node names:
      </p>

      <CodeBlock
        language="typescript"
        code={`registry.register(new MyElementWidget());`}
      />

      <p>
        After registration, any <code>&lt;MyElement&gt;</code> node in the scene JSX will be
        compiled and dispatched to this widget instance.
      </p>

      <h2><code>registerTypeFactory(component, factory)</code></h2>

      <p>
        For polymorphic widgets keyed by a <code>type</code> prop, register a factory function
        instead of a single instance. The registry calls the factory the first time it encounters
        each unique type value and caches the result:
      </p>

      <CodeBlock
        language="typescript"
        code={`registry.registerTypeFactory('Model', (type: string) => {
  switch (type) {
    case 'RobotArm':   return new RobotArmWidget();
    case 'MaleDummy':  return new MaleDummyWidget();
    case 'Server':     return new ServerModelWidget();
    default:
      throw new Error(\`Unknown Model type: "\${type}"\`);
  }
});`}
      />

      <h2><code>createDefaultWidgetRegistry(manifest)</code></h2>

      <p>
        Creates a pre-configured registry with all built-in widgets registered. Pass the asset
        manifest (from <code>siteResources.ts</code>) to wire up model loading. Pass{' '}
        <code>null</code> if you're not loading models:
      </p>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Widget ID</th>
            <th>DSL Component</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>Camera</code></td>
            <td><code>&lt;Camera&gt;</code></td>
            <td>Three.js perspective camera, all positioning modes</td>
          </tr>
          <tr>
            <td><code>Lighting</code></td>
            <td><code>&lt;Lighting&gt;</code></td>
            <td>Scene lights (ambient, directional, point, spot)</td>
          </tr>
          <tr>
            <td><code>Background</code></td>
            <td><code>&lt;Background&gt;</code></td>
            <td>Scene background color</td>
          </tr>
          <tr>
            <td><code>Environment</code></td>
            <td><code>&lt;Environment&gt;</code></td>
            <td>HDR environment map for image-based lighting</td>
          </tr>
          <tr>
            <td><code>Floor</code></td>
            <td><code>&lt;Floor&gt;</code></td>
            <td>Reflective ground plane</td>
          </tr>
          <tr>
            <td><code>Model</code></td>
            <td><code>&lt;Model&gt;</code></td>
            <td>GLTF model loader with animation playback (type factory)</td>
          </tr>
          <tr>
            <td><code>SceneMeta</code></td>
            <td>internal</td>
            <td>Publishes scene id, index, and progress to VariableStore</td>
          </tr>
          <tr>
            <td>HUD system</td>
            <td><code>&lt;Hud&gt;</code>, <code>&lt;HudItem&gt;</code></td>
            <td>Overlay system with Anime.js-driven transitions</td>
          </tr>
          <tr>
            <td>Input system</td>
            <td><code>&lt;InputController&gt;</code>, <code>&lt;Action&gt;</code></td>
            <td>Action-mapped scene navigation and camera input</td>
          </tr>
        </tbody>
      </table>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { manifest } from './generated/siteResources';

const registry = createDefaultWidgetRegistry(manifest);`}
      />

      <h2>Extending the Default Registry</h2>

      <p>
        The most common pattern: start with the default registry and add your own widgets on top.
        Call <code>register</code> or <code>registerTypeFactory</code> on the returned registry
        before returning it from <code>widgetSetup</code>:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { MyElementWidget } from './my-element/MyElementWidget';
import { ParticleWidget } from './particles/ParticleWidget';

function setupWidgets(manifest) {
  const registry = createDefaultWidgetRegistry(manifest);
  registry.register(new MyElementWidget());
  registry.register(new ParticleWidget());
  return registry;
}`}
      />

      <Callout type="note">
        The registry is created once per player instance. Pass it as the return value of the{' '}
        <code>widgetSetup</code> function prop on <code>ScenePlayer</code>. The function receives
        the manifest as its argument, so you can use it for model setup.
      </Callout>

      <p>
        For a step-by-step walkthrough of building a widget to register, see{' '}
        <Link to="/core/custom-widget">Creating a Custom Widget</Link>.
      </p>
    </section>
  );
}
