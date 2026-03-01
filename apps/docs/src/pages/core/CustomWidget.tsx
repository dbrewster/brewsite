import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';

export default function CustomWidget(): JSX.Element {
  return (
    <section>
      <h1>Creating a Custom Widget</h1>

      <Callout type="tip">
        Custom widgets are the primary extension point in BrewSite. The toolkit's own built-in
        elements — <code>Camera</code>, <code>Lighting</code>, <code>Background</code>,{' '}
        <code>Floor</code> — all use the same SDK interfaces exposed to you.
      </Callout>

      <h2>The Element Module Pattern</h2>

      <p>
        Every custom element follows a mandatory 5-file module pattern. This enforces a clean
        separation between the data model, DSL surface, compilation logic, rendering, and the
        widget integration layer:
      </p>

      <CodeBlock
        language="typescript"
        code={`my-element/
├── types.ts            # State shape (pure TypeScript, no imports from Three.js/React)
├── dsl.tsx             # React DSL component (no Three.js)
├── compile.ts          # Pure state transformation (no React, no Three.js)
├── render.ts           # Three.js application (no React, no compiler imports)
├── MyElementWidget.ts  # IWidget implementation (bridges compile → render)
└── index.ts            # Public re-exports only`}
      />

      <p>
        The direction is strictly one-way:{' '}
        <code>types.ts → dsl.tsx → compile.ts → render.ts → MyElementWidget.ts</code>. Inner
        layers never import from outer ones.
      </p>

      <h2>Step 1: Define the State Shape (<code>types.ts</code>)</h2>

      <p>
        The state shape is a plain TypeScript interface describing the complete set of properties
        your element can express at any point in time. Keep this file free of all runtime
        dependencies — no Three.js, no React, no imports of any kind beyond TypeScript itself.
      </p>

      <CodeBlock
        language="typescript"
        code={`// types.ts — interface contracts only; zero runtime, Three.js, or React imports
export interface MyElementState {
  color: string;
  opacity: number;
  visible: boolean;
}

export const DEFAULT_MY_ELEMENT: MyElementState = {
  color: '#ffffff',
  opacity: 1.0,
  visible: true,
};`}
      />

      <p>
        The <code>DEFAULT_MY_ELEMENT</code> constant provides the fallback values used by the
        compiler when a scene doesn't specify all props. Always define it next to the interface.
      </p>

      <h2>Step 2: Define the DSL Component (<code>dsl.tsx</code>)</h2>

      <p>
        The DSL file exposes a React component that authors use in their scene JSX. The component
        doesn't render anything — it calls <code>registerNode</code> to declare its presence to
        the compiler, then returns <code>null</code>. No Three.js imports are allowed here.
      </p>

      <CodeBlock
        language="tsx"
        code={`// dsl.tsx — React DSL; no Three.js imports
import { registerNode } from '@brewsite/core';
import type { MyElementState } from './types';

interface MyElementProps extends Partial<MyElementState> {}

export function MyElement(props: MyElementProps): null {
  registerNode('MyElement', props);
  return null;
}`}
      />

      <Callout type="note">
        The component name passed to <code>registerNode</code> — <code>'MyElement'</code> here —
        must match the <code>widgetId</code> you declare on the widget class in Step 4.
      </Callout>

      <h2>Step 3: Define the Transition Spec (<code>compile.ts</code>)</h2>

      <p>
        The transition spec tells the compiler how to interpolate between two states for each
        property. You pick a blend function from the core math helpers for each field. This file
        must be pure — no React, no Three.js.
      </p>

      <CodeBlock
        language="typescript"
        code={`// compile.ts — pure transformation; no React, no Three.js
import { blendColor, blendOpacity, blendNumber } from '@brewsite/core';
import type { ElementTransitionSpec } from '@brewsite/core';
import type { MyElementState } from './types';
import { DEFAULT_MY_ELEMENT } from './types';

export const myElementTransitionSpec: ElementTransitionSpec<MyElementState> = {
  color:   { blend: blendColor,   default: DEFAULT_MY_ELEMENT.color },
  opacity: { blend: blendOpacity, default: DEFAULT_MY_ELEMENT.opacity },
  visible: { blend: (a, b, t) => (t < 0.5 ? a : b), default: DEFAULT_MY_ELEMENT.visible },
};`}
      />

      <p>
        The built-in blend helpers available from <code>@brewsite/core</code>:
      </p>
      <ul>
        <li><code>blendNumber(a, b, t)</code> — linear number interpolation</li>
        <li><code>blendColor(a, b, t)</code> — CSS color interpolation via LAB color space</li>
        <li><code>blendOpacity(a, b, t)</code> — opacity interpolation, clamped 0–1</li>
        <li><code>blendVec3(a, b, t)</code> — Three.js Vector3 interpolation</li>
      </ul>
      <p>
        For discrete values like <code>boolean</code> or enum strings, use a step function
        (switch at <code>t = 0.5</code> as shown above).
      </p>

      <h2>Step 4: Implement the Widget (<code>MyElementWidget.ts</code>)</h2>

      <p>
        The widget class is the runtime integration layer. It implements <code>ISceneElement</code>{' '}
        to connect to the compiler, <code>IRenderable</code> to apply state to Three.js objects,
        and any other interfaces it needs. This is the only file where Three.js code lives.
      </p>

      <CodeBlock
        language="typescript"
        code={`// MyElementWidget.ts — implements ISceneElement + IRenderable
import * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { myElementTransitionSpec } from './compile';
import type { MyElementState } from './types';

export class MyElementWidget implements ISceneElement, IRenderable {
  readonly widgetId = 'MyElement';
  private mesh: THREE.Mesh | null = null;

  compileNode(_node: unknown): Partial<MyElementState> {
    return _node as Partial<MyElementState>;
  }

  buildTransitionSpec() {
    return myElementTransitionSpec;
  }

  initialize(ctx: WidgetInitContext): void {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial()
    );
    ctx.scene.add(this.mesh);
  }

  apply(state: MyElementState, _ctx: WidgetRenderContext): void {
    if (!this.mesh) return;
    this.mesh.visible = state.visible;
    (this.mesh.material as THREE.MeshStandardMaterial).color.set(state.color);
    (this.mesh.material as THREE.MeshStandardMaterial).opacity = state.opacity;
  }

  dispose(ctx: WidgetInitContext): void {
    if (this.mesh) ctx.scene.remove(this.mesh);
  }
}`}
      />

      <Callout type="note">
        <code>widgetId</code> must exactly match the string passed to <code>registerNode</code>{' '}
        in <code>dsl.tsx</code>. The registry uses this string to route compiled DSL nodes to
        the correct widget instance.
      </Callout>

      <h2>Step 5: Register the Widget</h2>

      <p>
        Widgets are registered in the <code>widgetSetup</code> function you pass to{' '}
        <code>ScenePlayer</code>. Start with <code>createDefaultWidgetRegistry</code> (which
        registers all built-in widgets), then add your custom widget:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { MyElementWidget } from './my-element/MyElementWidget';

const registry = createDefaultWidgetRegistry(null);
registry.register(new MyElementWidget());`}
      />

      <p>
        Pass the registry to <code>ScenePlayer</code> via the <code>widgetSetup</code> prop:
      </p>

      <CodeBlock
        language="tsx"
        code={`function setupWidgets(manifest) {
  const registry = createDefaultWidgetRegistry(manifest);
  registry.register(new MyElementWidget());
  return registry;
}

<ScenePlayer scenes={<MyScenes />} widgetSetup={setupWidgets} />`}
      />

      <h2>Step 6: Use It in a Scene</h2>

      <p>
        Once registered, the DSL component is available in any scene. Props left unspecified fall
        back to the defaults from <code>DEFAULT_MY_ELEMENT</code>:
      </p>

      <CodeBlock
        language="tsx"
        code={`<Scene key="s1">
  <MyElement color="#ff6600" opacity={0.9} />
</Scene>

<Scene key="s2">
  <MyElement color="#0066ff" opacity={0.5} visible={false} />
</Scene>`}
      />

      <p>
        The compiler will automatically interpolate <code>color</code>, <code>opacity</code>, and{' '}
        <code>visible</code> between scenes using the blend functions you defined in{' '}
        <code>compile.ts</code>.
      </p>

      <h2>Type-Factory Pattern (Polymorphic Widgets)</h2>

      <p>
        For widgets with multiple sub-types keyed by a <code>type</code> prop — like{' '}
        <code>&lt;Model type="MaleDummy" /&gt;</code> — use <code>registerTypeFactory</code>. The
        factory is called with the <code>type</code> string and returns the correct widget instance:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { MyVariantAWidget } from './my-element/MyVariantAWidget';
import { MyVariantBWidget } from './my-element/MyVariantBWidget';

const registry = createDefaultWidgetRegistry(manifest);

registry.registerTypeFactory('MyElement', (type: string) => {
  switch (type) {
    case 'VariantA': return new MyVariantAWidget();
    case 'VariantB': return new MyVariantBWidget();
    default:
      throw new Error(\`Unknown MyElement type: \${type}\`);
  }
});`}
      />

      <p>
        The DSL component passes <code>type</code> as a prop, and the registry calls your factory
        on first encounter of each unique type value.
      </p>

      <h2><code>CUSTOM_NODE_HANDLER</code></h2>

      <p>
        For widgets that need to handle nested JSX — like the <code>Diagram</code> element which
        contains child <code>Node</code>, <code>Edge</code>, and <code>Group</code> components —
        use the <code>CUSTOM_NODE_HANDLER</code> symbol to register a bespoke DSL node handler:
      </p>

      <CodeBlock
        language="typescript"
        code={`import { CUSTOM_NODE_HANDLER } from '@brewsite/core';
import type { IDslComposite, WidgetRegistry } from '@brewsite/core';

export class DiagramWidget implements IDslComposite {
  readonly widgetId = 'Diagram';

  // The registry calls [CUSTOM_NODE_HANDLER](registry, nodeTree)
  // when it encounters a <Diagram> node with children.
  [CUSTOM_NODE_HANDLER](registry: WidgetRegistry, nodeTree: unknown): void {
    // Walk nodeTree and register sub-nodes (Node, Edge, Group) yourself.
    // This gives you full control over nested DSL compilation.
  }
}`}
      />

      <Callout type="tip">
        <code>CUSTOM_NODE_HANDLER</code> is the escape hatch for composite elements. Most
        widgets never need it — the standard <code>ISceneElement.compileNode</code> path covers
        the vast majority of use cases.
      </Callout>

      <p>
        For more on sharing state between widgets and React components, see{' '}
        <Link to="/core/variable-store">VariableStore</Link>. For the registry API, see{' '}
        <Link to="/core/widget-registry">WidgetRegistry</Link>.
      </p>
    </section>
  );
}
