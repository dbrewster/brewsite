import type { ReactElement } from 'react';
import { Section, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function CustomWidgetPage(): ReactElement {
  return (
    <Section<SectionId> id="custom-widget" title="Creating a Custom Widget">
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

      <h2>Step 2: Define the DSL Component (<code>dsl.tsx</code>)</h2>

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

      <h2>Step 4: Implement the Widget (<code>MyElementWidget.ts</code>)</h2>

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

      <h2>Step 5: Register the Widget</h2>

      <CodeBlock
        language="typescript"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';
import { MyElementWidget } from './my-element/MyElementWidget';

const registry = createDefaultWidgetRegistry(null);
registry.register(new MyElementWidget());`}
      />

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

      <CodeBlock
        language="tsx"
        code={`<Scene key="s1">
  <MyElement color="#ff6600" opacity={0.9} />
</Scene>

<Scene key="s2">
  <MyElement color="#0066ff" opacity={0.5} visible={false} />
</Scene>`}
      />

      <h2>Type-Factory Pattern (Polymorphic Widgets)</h2>

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

      <h2><code>CUSTOM_NODE_HANDLER</code></h2>

      <CodeBlock
        language="typescript"
        code={`import { CUSTOM_NODE_HANDLER } from '@brewsite/core';
import type { IDslComposite, WidgetRegistry } from '@brewsite/core';

export class DiagramWidget implements IDslComposite {
  readonly widgetId = 'Diagram';

  [CUSTOM_NODE_HANDLER](registry: WidgetRegistry, nodeTree: unknown): void {
    // Walk nodeTree and register sub-nodes (Node, Edge, Group) yourself.
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
        <a href="#variable-store">VariableStore</a>. For the registry API, see{' '}
        <a href="#widget-registry">WidgetRegistry</a>.
      </p>
    </Section>
  );
}
