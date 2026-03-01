import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import BasicSceneDemo, { CODE as BASIC_CODE } from '../../demos/core/BasicSceneDemo.demo';

export default function CoreConcepts(): JSX.Element {
  return (
    <section>
      <h1>Core Concepts</h1>

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
        <code>Camera</code>, <code>Lighting</code>, <code>Background</code>, and{' '}
        <code>Floor</code> are all widgets. You can build your own using the Widget SDK. (
        <code>Model</code> is provided by{' '}
        <Link to="/model/introduction">@brewsite/model</Link>.)
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
        <Link to="/core/widget-sdk">Read the Widget SDK docs →</Link>
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
            <td>
              Camera, Lighting, Background, Floor, Environment, and other built-in elements. The{' '}
              <code>model/</code> element module is being extracted to{' '}
              <code>@brewsite/model</code>. See{' '}
              <Link to="/model/model">@brewsite/model → Model</Link>.
            </td>
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

      <Callout type="note">
        <code>@brewsite/model</code> (GLTF loading, animation playback, bone-tracked labels) is a
        separate companion package and is not bundled with <code>@brewsite/core</code>. See the{' '}
        <Link to="/model/introduction">@brewsite/model docs</Link>.
      </Callout>

      <h2>SSR Safety</h2>

      <p>
        Three.js rendering is confined to <code>render.ts</code> files and only runs in the
        browser. The compiler, timeline, and widget interfaces are pure TypeScript with zero DOM
        dependencies.
      </p>

      <p>
        This means you can safely import and run the compiler in a Node.js server environment —
        useful for generating static scene metadata at build time or for server-side rendering
        pipelines that need to inspect scene structure without spinning up a browser.
      </p>

      <Callout type="note">
        The compiler can run on the server. Only <code>ScenePlayer</code> (and the Three.js render
        layer) requires a DOM environment.
      </Callout>

      <Callout type="tip">
        <strong>Tip:</strong> <code>ScenePlayer</code> is a convenience wrapper. If your layout
        needs the canvas in a specific position — sidebar layout, split panel, CSS Grid — use{' '}
        <code>EngineProvider</code> directly and place <code>SceneCanvas</code> exactly where you
        need it. See <Link to="/core/player">ScenePlayer &amp; EngineProvider</Link>.
      </Callout>

      <LiveDemo title="A minimal scene" code={BASIC_CODE}>
        <BasicSceneDemo />
      </LiveDemo>
    </section>
  );
}
