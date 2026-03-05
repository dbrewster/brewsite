import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { BasicSceneDemo } from '../../demos/core/BasicSceneDemo.demo';

export function CoreConceptsPage(): ReactElement {
  return (
    <Section<SectionId> id="concepts" title="Core Concepts">
      <h2>Declarative Scene Snapshots</h2>

      <p>
        A BrewSite scene is a pure declaration of what should exist at a moment in time. You
        describe positions, colors, and lighting — never animation curves or frame timings. The
        compiler infers what to animate and how.
      </p>

      <p>
        Think of each <code>&lt;Scene&gt;</code> as a keyframe in a timeline. You describe the
        start state and the end state; the compiler fills in every frame between them using the
        specified easing curve.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Scene A — camera is far back, lit warmly
<Scene key="overview">
  <Camera mode="world" position={[0, 4, 12]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#fff5e0" intensity={0.5} />
  </Lighting>
</Scene>

// Scene B — camera moves in close, lighting shifts cool
// Only the props that change need to be declared.
<Scene key="detail">
  <Camera mode="world" position={[0, 1, 4]} target={[0, 0.5, 0]} />
  <Lighting>
    <Ambient color="#c0d8ff" intensity={0.7} />
  </Lighting>
</Scene>`}
      />

      <h2>Pre-Baked SceneTrack</h2>

      <p>
        At build time (or first render in development), the compiler generates a flat{' '}
        <code>SceneTrack</code> — a pre-baked array of interpolated state for every tick. At
        runtime, advancing progress requires only an array lookup.
      </p>

      <p>
        This means the cost of a transition is paid exactly once, at compile time. No matter how
        complex your scene — dozens of cameras, lighting rigs, and model states — playback is O(1)
        per frame with no garbage.
      </p>

      <pre
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.6,
          background: 'var(--bg-code)',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto',
        }}
      >{`Your JSX  →  Compiler  →  SceneTrack  →  Runtime  →  Three.js Frame
(Scenes)     (compile.ts)  (flat array)   (Widgets)   (render.ts)`}</pre>

      <p>
        The <code>SceneTrack</code> is cached between renders. It only recompiles when your scene
        JSX changes — detected by a fast structural hash of the compiled DSL nodes.
      </p>

      <h2>The Widget System</h2>

      <p>
        Every renderable concept in BrewSite is a <strong>widget</strong>. The{' '}
        <code>Camera</code>, <code>Lighting</code>, <code>Background</code>, <code>Model</code>,
        and <code>Floor</code> are all widgets. You can build your own using the Widget SDK.
      </p>

      <p>
        Each widget implements the <code>IWidget</code> interface. Widgets that render to the 3D
        scene also implement <code>ISceneElement</code> and <code>IRenderable</code>. Widgets that
        load external assets (like GLTF files) implement <code>ILoadable</code>.
      </p>

      <CodeBlock
        language="typescript"
        code={`// Widget interface hierarchy (simplified)
interface IWidget {
  id: string;
  onTick(state: WidgetState, context: WidgetContext): void;
}

interface ISceneElement extends IWidget {
  // Widgets that participate in the 3D scene graph
}

interface IRenderable extends ISceneElement {
  render(scene: THREE.Scene): void;
  dispose(): void;
}

interface ILoadable extends IWidget {
  load(manifest: SceneManifest): Promise<void>;
}`}
      />

      <p>
        <a href="#widget-sdk">Read the Widget SDK docs →</a>
      </p>

      <h2>Layer Architecture</h2>

      <p>
        BrewSite's codebase is layered strictly from top (React/user-facing) to bottom
        (Three.js/browser). Each layer has a clear responsibility and dependency rule: upper layers
        may import from lower layers, never the reverse.
      </p>

      <table className="prop-table">
        <thead>
          <tr>
            <th>Layer</th>
            <th>Package</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Player</td>
            <td><code>@brewsite/core</code></td>
            <td>React integration, ScenePlayer, hooks</td>
          </tr>
          <tr>
            <td>Runtime</td>
            <td><code>@brewsite/core</code></td>
            <td>Widget tick loop, WidgetRegistry</td>
          </tr>
          <tr>
            <td>Compiler</td>
            <td><code>@brewsite/core</code></td>
            <td>JSX → SceneTrack pre-baking</td>
          </tr>
          <tr>
            <td>Elements</td>
            <td><code>@brewsite/core</code></td>
            <td>Camera, Lighting, Model, and other built-in elements</td>
          </tr>
          <tr>
            <td>Widget SDK</td>
            <td><code>@brewsite/core</code></td>
            <td>IWidget interfaces, VariableStore</td>
          </tr>
          <tr>
            <td>Math / Timeline</td>
            <td><code>@brewsite/core</code></td>
            <td>Vector math, timeline algebra, easing functions</td>
          </tr>
        </tbody>
      </table>

      <h2>SSR Safety</h2>

      <p>
        Three.js rendering is confined to <code>render.ts</code> files and only runs in the
        browser. The compiler, timeline, and widget interfaces are pure TypeScript with zero DOM
        dependencies.
      </p>

      <Callout type="note">
        The compiler can run on the server. Only <code>ScenePlayer</code> (and the Three.js render
        layer) requires a DOM environment.
      </Callout>

      <DocsDemo title="A minimal scene" scrollUnits={2400} height={480}>
        <BasicSceneDemo />
      </DocsDemo>
    </Section>
  );
}
