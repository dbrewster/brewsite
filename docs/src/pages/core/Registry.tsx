import type { ReactElement } from 'react';
import { Section, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function RegistryPage(): ReactElement {
  return (
    <Section<SectionId> id="widget-registry" title="WidgetRegistry">
      <p>
        The <code>WidgetRegistry</code> maps DSL component names to widget instances. You create
        a registry once per <code>ScenePlayer</code> instance and pass it in via the{' '}
        <code>widgetSetup</code> prop.
      </p>

      <h2><code>register(widget)</code></h2>
      <CodeBlock
        language="typescript"
        code={`registry.register(new MyElementWidget());`}
      />

      <h2><code>registerTypeFactory(component, factory)</code></h2>
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
        </tbody>
      </table>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { manifest } from './generated/siteResources';

const registry = createDefaultWidgetRegistry(manifest);`}
      />

      <h2>Extending the Default Registry</h2>
      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { MyElementWidget } from './my-element/MyElementWidget';

function setupWidgets(manifest) {
  const registry = createDefaultWidgetRegistry(manifest);
  registry.register(new MyElementWidget());
  return registry;
}`}
      />

      <Callout type="note">
        The registry is created once per player instance. Pass it as the return value of the{' '}
        <code>widgetSetup</code> function prop on <code>ScenePlayer</code>.
      </Callout>

      <p>
        For a step-by-step walkthrough of building a widget to register, see{' '}
        <a href="#custom-widget">Creating a Custom Widget</a>.
      </p>
    </Section>
  );
}
