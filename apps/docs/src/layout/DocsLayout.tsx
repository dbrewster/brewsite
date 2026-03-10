// apps/docs/src/layout/DocsLayout.tsx
// Single continuous document div — the complete BrewSite docs page.

import { type JSX } from 'react';
import { corePlugin } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { CodeBlock, Callout, PropTable } from '@brewsite/docs';
import { NavProvider } from '../nav/NavContext';
import { DocsSidebar } from '../components/layout/DocsSidebar';
import { ActHeader } from '../components/ActHeader';
import { ProseBlock } from '../components/ProseBlock';
import { ScenePanel } from '../components/ScenePanel';

// Scene DSL imports (two-scene versions — owned by Stream F)
import { SceneWhatIsBrewSitePanel } from '../scenes/content/getting-started/sceneWhatIsBrewSite';
import { SceneInstallationPanel } from '../scenes/content/getting-started/sceneInstallation';
import { SceneQuickStartPanel } from '../scenes/content/getting-started/sceneQuickStart';
import { SceneConceptsPanel } from '../scenes/content/getting-started/sceneConcepts';
import { SceneSceneDslPanel } from '../scenes/content/scene-authoring/sceneSceneDsl';
import { SceneMultiScenePanel } from '../scenes/content/scene-authoring/sceneMultiScene';
import { SceneTransitionsPanel } from '../scenes/content/scene-authoring/sceneTransitions';
import { SceneProgressManagerPanel } from '../scenes/content/scene-authoring/sceneProgressManager';
import { SceneCameraPanel } from '../scenes/content/elements/sceneCamera';
import { SceneLightingPanel } from '../scenes/content/elements/sceneLighting';
import { SceneBackgroundPanel } from '../scenes/content/elements/sceneBackground';
import { SceneEnvironmentPanel } from '../scenes/content/elements/sceneEnvironment';
import { SceneFloorPanel } from '../scenes/content/elements/sceneFloor';
import { SceneHudPanel } from '../scenes/content/overlay-content/sceneHud';
import { SceneHudAnimejsPanel } from '../scenes/content/overlay-content/sceneHudAnimejs';
import { SceneInputNavigationPanel } from '../scenes/content/input/sceneInputNavigation';
import { SceneInputActionsPanel } from '../scenes/content/input/sceneInputActions';
import { ScenePlayerPanel } from '../scenes/content/player-hooks/scenePlayer';
import { SceneHooksPanel } from '../scenes/content/player-hooks/sceneHooks';
import { SceneWidgetSdkPanel } from '../scenes/content/widget-sdk/sceneWidgetSdk';
import { SceneCustomWidgetPanel } from '../scenes/content/widget-sdk/sceneCustomWidget';
import { SceneVariableStorePanel } from '../scenes/content/widget-sdk/sceneVariableStore';
import { SceneWidgetRegistryPanel } from '../scenes/content/widget-sdk/sceneWidgetRegistry';
import { SceneApiReferencePanel } from '../scenes/content/reference/sceneApiReference';
import { SceneTimelinePanel } from '../scenes/content/reference/sceneTimeline';

// Module-level stable plugin list — shared across all ScenePanels on this page.
// Must be module-level (not inside a component) to be referentially stable.
// All panels use the same corePlugin instance with identical options.
const DOCS_PLUGINS: WidgetPlugin[] = [corePlugin()];

export function DocsLayout(): JSX.Element {
  return (
    <NavProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <DocsSidebar />

        <main className="docs-main">
          {/* ── Act 1: Getting Started ──────────────────────────────────── */}
          <ActHeader id="act-getting-started" title="Getting Started" />

          <ProseBlock id="what-is-brewsite-prose">
            <h1>What is BrewSite Core?</h1>
            <p>
              <strong>@brewsite/core</strong> is a TypeScript + React + Three.js framework for building
              animated 3D marketing scenes. You describe scenes declaratively using a JSX DSL — the
              compiler pre-bakes smooth transitions into a flat track that renders at 60fps with zero
              frame-time computation.
            </p>
            <ul>
              <li><strong>Declarative Scene DSL</strong> — describe state, not animation</li>
              <li><strong>Pre-baked SceneTrack</strong> — O(1) sampling, zero jank</li>
              <li><strong>Widget SDK</strong> — extend with custom renderable concepts</li>
              <li><strong>Scroll &amp; Direct Mode</strong> — scroll-driven or programmatic control</li>
            </ul>
            <Callout type="tip">
              You&apos;ll have a running 3D animation scene in about 15 minutes. Start with{' '}
              <a href="#quick-start-prose">Quick Start</a>.
            </Callout>
            <h2>How it works</h2>
            <p>
              Unlike timeline-based animation tools, BrewSite is purely declarative. You write JSX that
              describes what your scene looks like at each keyframe — camera position, lighting color,
              background, floor opacity. The compiler handles the rest: it computes the interpolated
              values between every scene pair and pre-bakes them into a flat <code>SceneTrack</code>{' '}
              array.
            </p>
            <p>
              At runtime, advancing from scene to scene is a single array lookup — no easing math, no
              interpolation, no garbage. The Three.js render layer just reads from the pre-baked state
              and draws.
            </p>
            <h2>What&apos;s in the box</h2>
            <p><code>@brewsite/core</code> ships everything you need to build scroll-driven 3D sequences:</p>
            <ul>
              <li>
                <strong>Scene DSL</strong> — <code>&lt;Scene&gt;</code>, <code>&lt;Camera&gt;</code>,{' '}
                <code>&lt;Lighting&gt;</code>, <code>&lt;Background&gt;</code>,{' '}
                <code>&lt;Floor&gt;</code>, <code>&lt;Environment&gt;</code>
              </li>
              <li>
                <strong>ScenePlayer</strong> — React component that mounts a Three.js canvas and drives
                the render loop
              </li>
              <li>
                <strong>Scroll integration</strong> — <code>EngineScrollRegion</code> and{' '}
                <code>useEngineScroll</code> hook for scroll-driven progress
              </li>
              <li>
                <strong>HUD system</strong> — overlay 2D content with scroll-driven Anime.js transitions
              </li>
              <li>
                <strong>Widget SDK</strong> — <code>IWidget</code> interface for building your own
                renderable concepts
              </li>
              <li>
                <strong>Model loading</strong> — GLTF model loading and animation playback
              </li>
            </ul>
            <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />
          </ProseBlock>

          <ScenePanel
            id="scene-what-is-brewsite"
            height="480px"
            plugins={DOCS_PLUGINS}
          >
            <SceneWhatIsBrewSitePanel />
          </ScenePanel>

          <ProseBlock id="installation-prose">
            <h1>Installation</h1>
            <h2>Install the Package</h2>
            <p>Install <code>@brewsite/core</code> along with its peer dependencies via npm:</p>
            <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />
            <p>Or with pnpm:</p>
            <CodeBlock language="bash" code="pnpm add @brewsite/core three react react-dom" />

            <h2>Peer Dependencies</h2>
            <PropTable
              rows={[
                { name: 'three', type: '^0.183.1', required: true, description: 'Three.js rendering engine' },
                { name: 'react', type: '^19.2.4', required: true, description: 'React UI library' },
                { name: 'react-dom', type: '^19.2.4', required: true, description: 'React DOM bindings' },
              ]}
            />

            <h2>TypeScript</h2>
            <p>
              <code>@brewsite/core</code> is authored in strict TypeScript. Strict mode is required.
            </p>
            <Callout type="note">
              Strict TypeScript is required. Set <code>strict: true</code> in your tsconfig.
            </Callout>
            <CodeBlock
              language="json"
              code={`{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler"
  }
}`}
            />

            <h2>Vite Setup</h2>
            <p>
              If you&apos;re consuming from a monorepo workspace or source, add these Vite aliases so imports
              resolve to the source TypeScript directly:
            </p>
            <CodeBlock
              language="typescript"
              code={`// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@brewsite/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
});`}
            />

            <h2>Optional: camera-controls</h2>
            <p>
              <code>camera-controls</code> is required only if you use{' '}
              <code>{'interaction: { enabled: true }'}</code> on the <code>&lt;Camera&gt;</code> element.
            </p>
            <CodeBlock language="bash" code="npm install camera-controls" />
          </ProseBlock>

          <ScenePanel
            id="scene-installation"
            height="480px"
            plugins={DOCS_PLUGINS}
          >
            <SceneInstallationPanel />
          </ScenePanel>

          <ProseBlock id="quick-start-prose">
            <h1>Quick Start</h1>
            <Callout type="tip">
              You&apos;ll have a running 3D animation scene in about 15 minutes.
            </Callout>

            <h2>Step 1: Install</h2>
            <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />

            <h2>Step 2: Create the Widget Registry</h2>
            <p>
              The <strong>widget registry</strong> tells BrewSite which renderable concepts are active in
              your scene. <code>createDefaultWidgetRegistry</code> bundles all built-in widgets.
            </p>
            <CodeBlock
              language="tsx"
              code={`import { createDefaultWidgetRegistry } from '@brewsite/core';

// No model assets for this example — pass null
const registry = createDefaultWidgetRegistry(null);`}
            />

            <h2>Step 3: Author Your First Scene</h2>
            <p>
              Scenes are pure declarations of state. Place DSL element components as children of{' '}
              <code>&lt;Scene&gt;</code>. Each <code>&lt;Scene&gt;</code> needs a stable <code>key</code> prop.
            </p>
            <CodeBlock
              language="tsx"
              code={`import { Scene, Camera, Lighting, Ambient, Directional, Background, Floor, FloorPhysical } from '@brewsite/core';

function MyScenes() {
  return (
    <>
      <Scene key="intro">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Background color="#111122" />
        <Floor enabled>
          <FloorPhysical opacity={0.6} />
        </Floor>
      </Scene>

      <Scene key="detail">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
        <Background color="#1a0a2a" />
      </Scene>
    </>
  );
}`}
            />

            <Callout type="note">
              Elements not declared in a scene <strong>inherit from the previous scene</strong>.
            </Callout>

            <h2>Step 4: Mount ScenePlayer</h2>
            <CodeBlock
              language="tsx"
              code={`import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';

const registry = createDefaultWidgetRegistry(null);

function App() {
  return (
    <ScenePlayer
      manifestUrl="/scene-manifest.json"
      widgetSetup={() => registry}
      style={{ width: '100%', height: '500px' }}
    >
      {/* Your scenes go here */}
    </ScenePlayer>
  );
}`}
            />

            <h2>Step 5: Add Scroll Control</h2>
            <CodeBlock
              language="tsx"
              code={`import { ScenePlayer, EngineScrollRegion, createDefaultWidgetRegistry } from '@brewsite/core';

const registry = createDefaultWidgetRegistry(null);

function App() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <ScenePlayer
        manifestUrl="/scene-manifest.json"
        widgetSetup={() => registry}
        pixelsPerScene={800}
        style={{ width: '100%', height: '500px' }}
      >
        {/* scenes */}
      </ScenePlayer>
    </EngineScrollRegion>
  );
}`}
            />

            <h2>Next Steps</h2>
            <ul>
              <li><a href="#scene-dsl-prose">Learn the Scene DSL</a> — all elements, all props</li>
              <li><a href="#concepts-prose">Core Concepts</a> — understand the compiler and widget system</li>
            </ul>
          </ProseBlock>

          <ScenePanel
            id="scene-quick-start"
            height="480px"
            plugins={DOCS_PLUGINS}
          >
            <SceneQuickStartPanel />
          </ScenePanel>

          <ProseBlock id="concepts-prose">
            <h1>Core Concepts</h1>
            <h2>Declarative Scene Snapshots</h2>
            <p>
              A BrewSite scene is a pure declaration of what should exist at a moment in time. You
              describe positions, colors, and lighting — never animation curves or frame timings.
              The compiler infers what to animate and how.
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
              <code>SceneTrack</code> — a pre-baked array of interpolated state for every tick.
              Advancing progress requires only an array lookup — O(1) per frame.
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
              <code>Camera</code>, <code>Lighting</code>, <code>Background</code>,{' '}
              <code>Model</code>, and <code>Floor</code> are all widgets. You can build your own using
              the Widget SDK.
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

            <h2>Layer Architecture</h2>
            <p>
              BrewSite&apos;s codebase is layered strictly from top (React/user-facing) to bottom
              (Three.js/browser). Each layer has a clear responsibility and dependency rule.
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
          </ProseBlock>

          <ScenePanel
            id="scene-concepts"
            height="480px"
            plugins={DOCS_PLUGINS}
          >
            <SceneConceptsPanel />
          </ScenePanel>

          {/* ── Act 2: Scene Authoring ───────────────────────────────────── */}
          <ActHeader id="act-scene-authoring" title="Scene Authoring" />

          <ProseBlock id="scene-dsl-prose">
            <h1>Scene DSL</h1>
            <h2><code>&lt;Scene&gt;</code> Component</h2>
            <p>
              The <code>&lt;Scene&gt;</code> component is the fundamental authoring primitive. Each{' '}
              <code>&lt;Scene&gt;</code> represents a keyframe — a complete snapshot of your 3D world at
              one point in the timeline.
            </p>
            <PropTable
              rows={[
                {
                  name: 'key',
                  type: 'React.Key',
                  required: true,
                  description:
                    'Stable string identifier for this scene. Used for SceneTrack compilation and scene change callbacks. Do not use array indices.',
                },
                {
                  name: 'id',
                  type: 'string',
                  required: false,
                  description:
                    'Deprecated: use the React key prop. Backward-compatible alias retained for existing scenes.',
                },
                {
                  name: 'transition',
                  type: '{ easing?: EasingName }',
                  required: false,
                  description:
                    "Override the easing curve for this scene's entry transition.",
                },
              ]}
            />

            <h2>Scene Identity</h2>
            <Callout type="warning">
              Always set <code>key</code> as a stable, unique string. Do not use array indices — they
              break the SceneTrack cache when scenes are reordered.
            </Callout>
            <CodeBlock
              language="tsx"
              code={`// Good — stable, descriptive string keys
<Scene key="hero-intro">...</Scene>
<Scene key="product-detail">...</Scene>
<Scene key="cta-close">...</Scene>

// Bad — array indices break reordering and cache invalidation
{scenes.map((s, i) => (
  <Scene key={i}>...</Scene>
))}`}
            />

            <h2>Elements Inside <code>&lt;Scene&gt;</code></h2>
            <p>
              Place element components as direct children of <code>&lt;Scene&gt;</code>. Only declare the
              elements whose state you want to specify in this scene — undeclared elements inherit from the
              previous scene.
            </p>
            <ul>
              <li><a href="#camera-prose"><code>&lt;Camera&gt;</code></a> — camera position, mode, and interaction</li>
              <li><a href="#lighting-prose"><code>&lt;Lighting&gt;</code></a> — ambient and directional lights</li>
              <li><a href="#background-prose"><code>&lt;Background&gt;</code></a> — scene background color or texture</li>
              <li><a href="#floor-prose"><code>&lt;Floor&gt;</code></a> — reflective floor plane</li>
              <li><a href="#environment-prose"><code>&lt;Environment&gt;</code></a> — HDR environment map</li>
              <li><a href="#hud-prose"><code>&lt;Hud&gt;</code></a> — 2D overlay with scroll-driven transitions</li>
              <li><a href="#input-navigation-prose"><code>&lt;InputController&gt;</code></a> — scroll/direct-mode scene navigation</li>
            </ul>

            <h2>Scene Inheritance</h2>
            <p>
              Elements not declared in a scene inherit the previous scene&apos;s state. You only need to
              specify what changes.
            </p>
            <CodeBlock
              language="tsx"
              code={`<Scene key="scene-a">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} />
  </Floor>
</Scene>

<Scene key="scene-b">
  {/*
    Only the Camera changes. Lighting and Floor carry forward
    from scene-a without re-declaration.
  */}
  <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
</Scene>`}
            />
          </ProseBlock>
          <ScenePanel id="scene-scene-dsl" height="480px" plugins={DOCS_PLUGINS}>
            <SceneSceneDslPanel />
          </ScenePanel>

          <ProseBlock id="multi-scene-prose">
            <h1>Multi-Scene Sequences</h1>
            <p>
              BrewSite scenes are a sequence of keyframes. The <code>ScenePlayer</code> interpolates
              smoothly between them as the user scrolls (or as you drive progress programmatically). Each
              scene occupies an equal share of the total progress range, and only the props that differ
              from the previous scene are animated.
            </p>

            <h2>Ordering Scenes</h2>
            <p>
              Place <code>&lt;Scene&gt;</code> elements as children of <code>ScenePlayer</code> in order.
              The first scene is at progress <code>0</code>, the last is at progress <code>1</code>.
            </p>
            <CodeBlock
              language="tsx"
              code={`<ScenePlayer manifestUrl="/manifest.json" widgetSetup={() => registry}>
  <Scene key="s1">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
    <Lighting>
      <Ambient color="#ffffff" intensity={0.4} />
    </Lighting>
  </Scene>

  <Scene key="s2">
    <Camera mode="orbit" target={[0, 0, 0]} azimuth={1.0} polar={1.2} distance={6} />
    <Lighting>
      <Ambient color="#8855ff" intensity={0.6} />
    </Lighting>
  </Scene>

  <Scene key="s3">
    <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
    <Lighting>
      <Ambient color="#4488ff" intensity={0.5} />
    </Lighting>
  </Scene>
</ScenePlayer>`}
            />

            <h2>How Progress Works</h2>
            <CodeBlock
              language="typescript"
              code={`// Given N scenes, each scene spans 1/N of the progress range:
// Scene 0: progress [0.00, 0.33)
// Scene 1: progress [0.33, 0.67)
// Scene 2: progress [0.67, 1.00]

const sceneIndex = Math.floor(progress * sceneCount);`}
            />

            <h2>Scene Count and Frame Resolution</h2>
            <CodeBlock
              language="tsx"
              code={`{/* Default — good balance for most scenes */}
<ScenePlayer quality="balanced" manifestUrl="/manifest.json" widgetSetup={() => registry}>
  ...
</ScenePlayer>

{/* High — 120 ticks per scene, smoother transitions */}
<ScenePlayer quality="high" manifestUrl="/manifest.json" widgetSetup={() => registry}>
  ...
</ScenePlayer>`}
            />
            <Callout type="note">
              Higher quality increases compile time and memory for the SceneTrack, but has zero effect on
              runtime performance — the tick loop still does one array lookup per frame.
            </Callout>

            <h2>Scene Inheritance</h2>
            <p>
              Only props that differ from the previous scene are animated. Unchanged props hold their
              value with no re-declaration needed.
            </p>
            <Callout type="tip">
              Only declare what changes. This makes scenes concise and the SceneTrack cache efficient.
            </Callout>
            <CodeBlock
              language="tsx"
              code={`<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.4} />
    <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>

<Scene key="s2">
  {/* Only camera changes — Lighting and Floor hold their s1 values */}
  <Camera mode="world" position={[5, 4, 5]} target={[0, 0, 0]} />
</Scene>`}
            />
          </ProseBlock>
          <ScenePanel id="scene-multi-scene" height="480px" plugins={DOCS_PLUGINS}>
            <SceneMultiScenePanel />
          </ScenePanel>

          <ProseBlock id="transitions-prose">
            <h1>Transitions &amp; Easing</h1>
            <p>
              Every scene-to-scene transition is controlled by a <code>TransitionWindow</code> — a pair of
              sub-ranges within the block&apos;s <code>[0, 1]</code> progress that independently control when
              the outgoing scene fades out (<code>exit</code>) and when the incoming scene fades in (
              <code>enter</code>). Transition timing is pre-baked into the <code>SceneTrack</code> at
              compile time — there is no runtime interpolation cost.
            </p>

            <h2>The <code>transition</code> Prop</h2>
            <p>
              Pass a <code>TransitionWindow</code> to <code>&lt;Scene&gt;</code> to override the transition
              timing for that scene&apos;s entry.
            </p>
            <CodeBlock
              language="tsx"
              code={`import { TRANSITION_SEQUENTIAL } from '@brewsite/core';

<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="s2" transition={TRANSITION_SEQUENTIAL}>
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>`}
            />

            <h2>Built-in Window Presets</h2>
            <PropTable
              rows={[
                { name: 'TRANSITION_CROSSFADE', type: 'TransitionWindow', defaultValue: 'system default', description: 'Exit [0, 0.5], Enter [0.5, 1] — classic cross-fade.' },
                { name: 'TRANSITION_SEQUENTIAL', type: 'TransitionWindow', description: 'Exit [0, 0.4], Enter [0.6, 1] — outgoing finishes before incoming starts.' },
                { name: 'TRANSITION_EXIT_FIRST', type: 'TransitionWindow', description: 'Exit [0, 0.6], Enter [0.4, 1] — overlapping, outgoing has more time.' },
                { name: 'TRANSITION_CUT', type: 'TransitionWindow', description: 'Instant cut — no blending.' },
                { name: 'TRANSITION_DEFAULT', type: 'TransitionWindow', description: "Empty object — defers to each widget's own defaultWindow." },
              ]}
            />
            <Callout type="tip">
              You can also pass a custom <code>TransitionWindow</code> inline:{' '}
              <code>{'transition={{ exit: [0, 0.3], enter: [0.7, 1] }}'}</code>.
            </Callout>

            <h2>Entry vs. Exit Ownership</h2>
            <p>
              The <code>transition</code> prop belongs to the <strong>incoming scene</strong>, not the
              outgoing one. The transition from scene A to scene B is always declared on scene B.
            </p>
            <CodeBlock
              language="tsx"
              code={`<Scene key="scene-a">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-b" transition={TRANSITION_SEQUENTIAL}>
  {/* TRANSITION_SEQUENTIAL controls the A → B transition. */}
  <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
</Scene>

<Scene key="scene-c" transition={TRANSITION_CROSSFADE}>
  {/* TRANSITION_CROSSFADE controls the B → C transition. */}
  <Camera mode="world" position={[-3, 4, 6]} target={[0, 0, 0]} />
</Scene>`}
            />

            <h2>Custom Transition Specs</h2>
            <p>
              For widget authors building custom renderable concepts, BrewSite exposes two lower-level
              transition contracts for full control over interpolation:
            </p>
            <ul>
              <li>
                <strong>ElementTransitionSpec</strong> — discrete batch-fill model. The compiler calls{' '}
                <code>exit</code>, <code>enter</code>, or <code>interpolate</code> once per transition.
              </li>
              <li>
                <strong>FunctionalTransitionSpec</strong> — closure-based model. The compiler calls your
                factory once with endpoint states and returns a pure function of{' '}
                <code>TransitionContext</code>.
              </li>
            </ul>
            <CodeBlock
              language="typescript"
              code={`import type { FunctionalTransitionSpec } from '@brewsite/core';

const myTransitionSpec: FunctionalTransitionSpec<{ opacity: number }> = {
  exitFn: (fromState) => (ctx) => ({ opacity: fromState.opacity * (1 - ctx.t) }),
  enterFn: (toState) => (ctx) => ({ opacity: toState.opacity * ctx.t }),
  interpolateFn: (fromState, toState) => (ctx) => ({
    opacity: fromState.opacity + (toState.opacity - fromState.opacity) * ctx.t,
  }),
};`}
            />
          </ProseBlock>
          <ScenePanel id="scene-transitions" height="480px" plugins={DOCS_PLUGINS}>
            <SceneTransitionsPanel />
          </ScenePanel>

          <ProseBlock id="progress-manager-prose">
            <h1>ProgressManager</h1>
            <p>
              Controls how much scroll real estate each scene&apos;s transition consumes and the pacing
              curve within that window. Place inside <code>&lt;Scene&gt;</code>.
            </p>
          </ProseBlock>
          <ScenePanel id="scene-progress-manager" height="480px" plugins={DOCS_PLUGINS}>
            <SceneProgressManagerPanel />
          </ScenePanel>

          {/* ── Act 3: Elements ──────────────────────────────────────────── */}
          <ActHeader id="act-elements" title="Elements" />

          <ProseBlock id="camera-prose">
            <h1>Camera</h1>
            <p>
              The <code>&lt;Camera&gt;</code> element controls the Three.js perspective camera. It supports
              world-space positioning, orbit mode, and automatic model-framing modes. Every scene can declare
              a camera independently — the engine interpolates smoothly between positions when transitioning.
            </p>

            <h2>World Mode</h2>
            <p>
              World mode gives you explicit control: provide a 3D <code>position</code> and a{' '}
              <code>target</code> point the camera looks at. This is the most direct way to frame a specific
              area of your scene, and makes camera intent obvious when reading a scene file.
            </p>
            <CodeBlock code={`<Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />`} language="tsx" />

            <h2>Orbit Mode</h2>
            <p>
              Orbit mode positions the camera on a sphere around a target using spherical coordinates.
              It is ideal for turntable animations and cinematic fly-arounds where you want smooth angular
              control without manually computing Cartesian coordinates.
            </p>
            <CodeBlock
              code={`<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={1.5}
  polar={1.2}
  distance={6}
/>`}
              language="tsx"
            />
            <Callout type="note">
              Azimuth and polar are in radians. Azimuth <code>0</code> = positive Z axis; it increases
              counter-clockwise when viewed from above. Polar <code>0</code> = overhead (north pole);{' '}
              <code>Math.PI / 2</code> = equator (eye-level).
            </Callout>

            <h2>fitBotHeight Mode</h2>
            <p>
              Automatically frames a model by its foot-to-top height. The camera solves for a position that
              fills <code>framingHeightPct</code> of the viewport with the model&apos;s full height.
            </p>
            <CodeBlock
              code={`<Camera
  mode="fitBotHeight"
  targetId="character"
  targetHeight={1.8}
  framingHeightPct={0.85}
/>`}
              language="tsx"
            />
            <Callout type="note">
              Transitioning between <code>fitBotHeight</code> and <code>world</code>/<code>orbit</code> modes
              produces a hard cut at the midpoint rather than a smooth interpolation. For smooth cross-mode
              transitions, use <code>world</code> or <code>orbit</code> on both scenes.
            </Callout>

            <h2>fitFloorDepth Mode</h2>
            <p>
              Frames the camera to fit a floor plane between <code>floorZMin</code> and <code>floorZMax</code>{' '}
              within the viewport.
            </p>
            <CodeBlock
              code={`<Camera
  mode="fitFloorDepth"
  floorY={0}
  floorZMin={-4}
  floorZMax={4}
  lookAtZ={0}
/>`}
              language="tsx"
            />

            <h2>Lens Configuration</h2>
            <PropTable
              rows={[
                { name: 'fov', type: 'number', defaultValue: '50', description: 'Field of view in degrees.' },
                { name: 'focalLength', type: 'number', description: 'Focal length in mm. Overrides fov when set.' },
                { name: 'filmGauge', type: 'number', defaultValue: '35', description: 'Film gauge in mm. Used together with focalLength to compute fov.' },
                { name: 'near', type: 'number', defaultValue: '0.1', description: 'Near clip plane distance.' },
                { name: 'far', type: 'number', defaultValue: '1000', description: 'Far clip plane distance.' },
              ]}
            />

            <h2>Post Processing</h2>
            <PropTable
              rows={[
                { name: 'exposure', type: 'number', defaultValue: '1.0', description: 'Renderer tone mapping exposure. Values above 1 brighten; below 1 darken.' },
              ]}
            />

            <h2>Interactive Camera</h2>
            <p>
              Enable user orbit, dolly, and pan by adding an <code>interaction</code> config to any camera scene.
            </p>
            <CodeBlock
              code={`<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={0}
  polar={1.2}
  distance={6}
  interaction={{
    enabled: true,
    rotate: { sensitivity: 1.0 },
    zoom: { sensitivity: 0.5 },
  }}
/>`}
              language="tsx"
            />
            <Callout type="note">
              Interactive camera requires the <code>camera-controls</code> package. See Installation for setup
              instructions.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-camera" height="480px" plugins={DOCS_PLUGINS}>
            <SceneCameraPanel />
          </ScenePanel>

          <ProseBlock id="lighting-prose">
            <h1>Lighting</h1>
            <p>
              The <code>&lt;Lighting&gt;</code> element configures all lights in the scene through a
              declarative, composable child API. Lights are interpolated between scenes just like any other
              prop — color and intensity smoothly transition as the scene progresses.
            </p>

            <h2>Ambient Light</h2>
            <p>
              Ambient light illuminates all geometry uniformly from every direction, with no shadows and
              no position. It establishes the base luminosity and color tone of the scene.
            </p>
            <CodeBlock
              code={`<Lighting>
  <Ambient color="#ffffff" intensity={0.4} />
</Lighting>`}
              language="tsx"
            />
            <PropTable
              rows={[
                { name: 'color', type: 'string', required: true, description: 'CSS hex color. Tints the entire ambient contribution.' },
                { name: 'intensity', type: 'number', required: true, description: 'Brightness multiplier.' },
                { name: 'id', type: 'string', description: 'Optional stable identifier for this light instance.' },
              ]}
            />

            <h2>Directional Light</h2>
            <p>
              Directional light casts parallel rays from a given position, simulating a distant light source
              like the sun.
            </p>
            <CodeBlock
              code={`<Lighting>
  <Ambient color="#ffffff" intensity={0.3} />
  <Directional
    color="#ffeedd"
    intensity={1.2}
    position={[5, 8, 5]}
  />
</Lighting>`}
              language="tsx"
            />
            <PropTable
              rows={[
                { name: 'color', type: 'string', required: true, description: 'CSS hex color.' },
                { name: 'intensity', type: 'number', required: true, description: 'Brightness multiplier.' },
                { name: 'position', type: '[number, number, number]', required: true, description: 'World-space position used to derive the light direction (points toward origin).' },
                { name: 'id', type: 'string', description: 'Optional stable identifier.' },
              ]}
            />

            <h2>Point Lights</h2>
            <p>
              Point lights emit in all directions from a position in 3D space, like a light bulb.
            </p>
            <CodeBlock
              code={`<Lighting>
  <Ambient color="#ffffff" intensity={0.3} />
  <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
  <Point color="#ff6600" intensity={2.0} position={[0, 2, 0]} />
</Lighting>`}
              language="tsx"
            />

            <h2>The <code>&lt;Lighting&gt;</code> Prop API</h2>
            <PropTable
              rows={[
                { name: 'intensityScale', type: 'number', defaultValue: '1', description: 'Global multiplier applied to all child light intensities.' },
                { name: 'color', type: 'string', description: 'Global tint color mixed across all child lights.' },
              ]}
            />
            <Callout type="tip">
              Start with a low-intensity ambient (<code>0.3–0.5</code>) plus one directional light at a
              roughly 45-degree angle above and to the side. Add a subtle warm tint to the directional
              for a natural cinematic look.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-lighting" height="480px" plugins={DOCS_PLUGINS}>
            <SceneLightingPanel />
          </ScenePanel>

          <ProseBlock id="background-prose">
            <h1>Background</h1>
            <p>
              The <code>&lt;Background&gt;</code> element controls what appears behind your 3D scene. It
              supports image-based backgrounds rendered on a 3D plane in world space, as well as a DOM
              fallback mode that applies a CSS background to the container.
            </p>

            <h2>Color Backgrounds</h2>
            <p>
              For purely color-based backgrounds, omit <code>&lt;Background&gt;</code> entirely and control
              the atmosphere through the <code>&lt;Lighting&gt;</code> ambient color. The ambient color
              floods the scene geometry and floor, effectively tinting the overall visual tone.
            </p>

            <h2>Image Backgrounds</h2>
            <p>
              For image-based backgrounds, provide an <code>imageUrl</code>. In 3D plane mode, the image
              is rendered on a world-space quad behind the scene geometry.
            </p>
            <CodeBlock
              code={`// Image-based background using a 3D plane in world space.
<Background imageUrl="/assets/backgrounds/gradient.png" opacity={1.0} />

// DOM fallback mode — uses CSS background-* properties.
<Background
  imageUrl="/assets/backgrounds/gradient.png"
  opacity={0.9}
  cssPosition="center top"
  cssSize="cover"
  cssRepeat="no-repeat"
/>`}
              language="tsx"
            />

            <h2><code>&lt;Background&gt;</code> Props</h2>
            <PropTable
              rows={[
                {
                  name: 'imageUrl',
                  type: 'string',
                  description:
                    'URL of the background image. When omitted, no background image is rendered — use ambient light color for scene tone.',
                },
                {
                  name: 'opacity',
                  type: 'number',
                  defaultValue: '1.0',
                  description: 'Background image opacity from 0 (transparent) to 1 (fully opaque).',
                },
                {
                  name: 'position',
                  type: '[number, number, number]',
                  description:
                    'World-space offset for the 3D background plane mode.',
                },
                {
                  name: 'cssPosition',
                  type: 'string',
                  description:
                    "CSS background-position value for DOM fallback mode (e.g. 'center top').",
                },
                {
                  name: 'cssSize',
                  type: 'string',
                  description:
                    "CSS background-size value for DOM fallback mode (e.g. 'cover' or '100% auto').",
                },
                {
                  name: 'cssRepeat',
                  type: 'string',
                  description:
                    "CSS background-repeat value for DOM fallback mode (e.g. 'no-repeat').",
                },
              ]}
            />
            <Callout type="tip">
              Background image opacity is interpolated between scenes just like any other prop. Use deep,
              desaturated colors and controlled ambient intensity for a cinematic look.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-background" height="480px" plugins={DOCS_PLUGINS}>
            <SceneBackgroundPanel />
          </ScenePanel>

          <ProseBlock id="environment-prose">
            <h1>Environment</h1>
            <p>
              The <code>&lt;Environment&gt;</code> element loads an HDR or EXR environment map and applies
              it as the scene&apos;s image-based lighting (IBL). This produces physically-based reflections and
              soft ambient illumination on all metallic and reflective surfaces.
            </p>

            <h2>HDR Environment Maps</h2>
            <p>
              HDRI files (<code>.hdr</code>) are the most common format for environment maps. Use{' '}
              <code>&lt;EnvironmentHdri&gt;</code> as the child source.
            </p>
            <CodeBlock
              code={`<Environment enabled intensity={1.0}>
  <EnvironmentHdri url="/assets/envmaps/studio.hdr" />
</Environment>`}
              language="tsx"
            />

            <h2>EXR Environment Maps</h2>
            <p>
              EXR files (<code>.exr</code>) offer higher dynamic range precision than HDRI. Use{' '}
              <code>&lt;EnvironmentExr&gt;</code> when you need wider exposure latitude.
            </p>
            <CodeBlock
              code={`<Environment enabled intensity={0.8}>
  <EnvironmentExr url="/assets/envmaps/outdoor.exr" />
</Environment>`}
              language="tsx"
            />

            <h2>Showing the Environment as Background</h2>
            <p>
              By default the environment map only contributes to scene lighting and is invisible as a
              background. Set <code>background</code> on the source child to also render it behind the
              scene geometry.
            </p>
            <CodeBlock
              code={`<Environment enabled intensity={1.0}>
  <EnvironmentHdri url="/assets/envmaps/studio.hdr" background />
</Environment>`}
              language="tsx"
            />

            <h2>Cube Map</h2>
            <CodeBlock
              code={`<Environment enabled intensity={1.0}>
  <EnvironmentCube
    urls={[
      '/assets/envmaps/px.png',
      '/assets/envmaps/nx.png',
      '/assets/envmaps/py.png',
      '/assets/envmaps/ny.png',
      '/assets/envmaps/pz.png',
      '/assets/envmaps/nz.png',
    ]}
  />
</Environment>`}
              language="tsx"
            />

            <h2>Generating Environment Maps</h2>
            <CodeBlock code="pnpm --filter @brewsite/diagram gen-envmap" language="bash" />
            <Callout type="note">
              The generated env map is placed at{' '}
              <code>packages/diagram/src/elements/diagram/assets/envmaps/</code>.
            </Callout>

            <h2><code>&lt;Environment&gt;</code> Props</h2>
            <PropTable
              rows={[
                {
                  name: 'enabled',
                  type: 'boolean',
                  defaultValue: 'false',
                  description:
                    'Activates the environment element. When false, no IBL is applied regardless of child source.',
                },
                {
                  name: 'intensity',
                  type: 'number',
                  defaultValue: '1.0',
                  description:
                    'Scale factor for the IBL contribution. Lower values reduce reflections without removing them entirely.',
                },
              ]}
            />

            <h2>Source Child Props</h2>
            <PropTable
              rows={[
                {
                  name: 'url',
                  type: 'string',
                  required: true,
                  description:
                    'Path to the HDR or EXR file. Used on EnvironmentHdri and EnvironmentExr.',
                },
                {
                  name: 'urls',
                  type: '[string, string, string, string, string, string]',
                  required: true,
                  description:
                    'Six face paths in [px, nx, py, ny, pz, nz] order. Used on EnvironmentCube only.',
                },
                {
                  name: 'background',
                  type: 'boolean',
                  defaultValue: 'false',
                  description:
                    'When true, renders the environment texture as the visible scene background in addition to using it for IBL.',
                },
              ]}
            />
          </ProseBlock>
          <ScenePanel id="scene-environment" height="480px" plugins={DOCS_PLUGINS}>
            <SceneEnvironmentPanel />
          </ScenePanel>

          <ProseBlock id="floor-prose">
            <h1>Floor</h1>
            <p>
              The <code>&lt;Floor&gt;</code> element renders a ground plane beneath your scene. It supports
              two surface types: a full PBR physical material via <code>&lt;FloorPhysical&gt;</code>, and a
              real-time mirror reflection via <code>&lt;FloorMirror&gt;</code>.
            </p>

            <h2>Physical Floor</h2>
            <p>
              <code>&lt;FloorPhysical&gt;</code> uses Three.js <code>MeshStandardMaterial</code>. It supports
              the full PBR texture pipeline: diffuse, normal, roughness, metalness, AO, and emissive maps.
            </p>
            <CodeBlock
              code={`<Floor enabled>
  <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
</Floor>`}
              language="tsx"
            />

            <h2>Mirror Floor</h2>
            <p>
              <code>&lt;FloorMirror&gt;</code> renders a real-time reflection of the scene above the floor
              plane. Use it when you want a crisp mirror effect rather than a physically roughened reflection.
            </p>
            <CodeBlock
              code={`<Floor enabled>
  <FloorMirror
    mirrorOpacity={0.9}
    mirrorResolution={512}
    mirrorClipBias={0.003}
  />
</Floor>`}
              language="tsx"
            />

            <h2>Textured Floor</h2>
            <CodeBlock
              code={`<Floor enabled position={[0, 0, 0]} scale={30}>
  <FloorPhysical
    textureUrl="/assets/floor/concrete-diffuse.jpg"
    normalMapUrl="/assets/floor/concrete-normal.jpg"
    roughnessMapUrl="/assets/floor/concrete-roughness.jpg"
    textureRepeat={[4, 4]}
    opacity={1.0}
    metalness={0.0}
    roughness={0.9}
  />
</Floor>`}
              language="tsx"
            />

            <h2><code>&lt;Floor&gt;</code> Props</h2>
            <PropTable
              rows={[
                { name: 'enabled', type: 'boolean', defaultValue: 'false', description: 'Activates the floor plane. When false, no floor geometry is rendered.' },
                { name: 'position', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'World-space position offset for the floor plane.' },
                { name: 'rotation', type: '[number, number, number]', defaultValue: '[0, 0, 0]', description: 'Euler rotation in radians.' },
                { name: 'scale', type: 'number', defaultValue: '20', description: 'Floor plane size in world units.' },
              ]}
            />

            <h2><code>&lt;FloorPhysical&gt;</code> Props</h2>
            <PropTable
              rows={[
                { name: 'opacity', type: 'number', defaultValue: '1.0', description: 'Floor surface opacity (0 = invisible, 1 = fully opaque).' },
                { name: 'metalness', type: 'number', defaultValue: '0', description: 'PBR metalness factor (0 = dielectric, 1 = full metal).' },
                { name: 'roughness', type: 'number', defaultValue: '1.0', description: 'PBR roughness factor (0 = mirror-smooth, 1 = fully diffuse).' },
                { name: 'color', type: 'string', defaultValue: '"#ffffff"', description: 'Base diffuse color tint applied before any texture.' },
                { name: 'textureUrl', type: 'string', description: 'Diffuse texture image URL.' },
                { name: 'normalMapUrl', type: 'string', description: 'Normal map image URL.' },
                { name: 'roughnessMapUrl', type: 'string', description: 'Grayscale roughness map URL.' },
                { name: 'textureRepeat', type: '[number, number]', defaultValue: '[1, 1]', description: 'UV tiling for all textures in [u, v] repeats.' },
                { name: 'clearcoat', type: 'number', defaultValue: '0', description: 'Clearcoat layer strength (0–1).' },
                { name: 'envMapIntensity', type: 'number', defaultValue: '1.0', description: 'Scale factor for environment map reflections.' },
                { name: 'emissive', type: 'string', description: 'Emissive color.' },
                { name: 'emissiveIntensity', type: 'number', defaultValue: '1.0', description: 'Multiplier for emissive output.' },
              ]}
            />

            <h2><code>&lt;FloorMirror&gt;</code> Props</h2>
            <PropTable
              rows={[
                { name: 'mirrorOpacity', type: 'number', defaultValue: '0.5', description: 'Reflection opacity.' },
                { name: 'mirrorResolution', type: 'number', defaultValue: '256', description: 'Render resolution for the reflection pass in pixels.' },
                { name: 'mirrorClipBias', type: 'number', defaultValue: '0.003', description: 'Clip plane bias to prevent z-fighting artefacts.' },
                { name: 'mirrorColor', type: 'string', description: 'Tint color mixed into the mirror reflection.' },
              ]}
            />
            <Callout type="tip">
              A subtle <code>&lt;FloorPhysical&gt;</code> (opacity 0.3–0.5, roughness 0.6–0.8) adds
              spatial depth without overwhelming the scene. For a true mirror, switch to{' '}
              <code>&lt;FloorMirror&gt;</code> with <code>mirrorOpacity</code> above 0.8.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-floor" height="480px" plugins={DOCS_PLUGINS}>
            <SceneFloorPanel />
          </ScenePanel>

          {/* ── Act 4: Overlay Content ───────────────────────────────────── */}
          <ActHeader id="act-overlay-content" title="Overlay Content" />

          <ProseBlock id="hud-prose">
            <h1>Scene Overlay</h1>
            <p>
              Any HTML or React children placed inside a <code>{'<Scene>'}</code> become 2D overlay
              content rendered above the Three.js canvas by <code>EngineOverlayHost</code>. This is how
              you add text, UI panels, callouts, and interactive elements to your scenes — no special
              wrapper component required.
            </p>

            <h2>Basic Pattern</h2>
            <p>
              Place any JSX inside <code>{'<Scene>'}</code> alongside the DSL elements. The engine
              collects these HTML children and renders them in <code>EngineOverlayHost</code>.
            </p>
            <CodeBlock
              language="tsx"
              code={`// HTML children inside <Scene> become overlay content rendered by EngineOverlayHost.
<Scene key="hero" id="hero">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <div style={{ position: 'absolute', bottom: '8%', left: '6%', color: '#fff', pointerEvents: 'none' }}>
    <h1 style={{ fontSize: 42, fontWeight: 700 }}>BrewSite</h1>
  </div>
</Scene>`}
            />

            <h2>Scene-Specific Content</h2>
            <p>
              Each <code>{'<Scene>'}</code> has its own overlay children. When the engine transitions
              between scenes, the outgoing scene&apos;s overlay is swapped for the incoming scene&apos;s overlay.
            </p>
            <CodeBlock
              language="tsx"
              code={`<Scene key="intro">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#fff', fontWeight: 700 }}>
    Intro
  </div>
</Scene>

<Scene key="features">
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontWeight: 700 }}>
    Features
  </div>
</Scene>`}
            />
            <Callout type="note">
              3D DSL elements (<code>Camera</code>, <code>Lighting</code>, etc.) carry forward to
              subsequent scenes when not re-declared. HTML overlay children do <em>not</em> carry
              forward — each scene renders its own overlay from scratch.
            </Callout>

            <h2>Pointer Events</h2>
            <p>
              By default the overlay container does not block pointer events from reaching the canvas.
              When you need interactive overlay elements (buttons, links), use{' '}
              <code>{'pointer-events: none'}</code> on the overlay wrapper and{' '}
              <code>{'pointer-events: auto'}</code> on individual interactive children.
            </p>
            <CodeBlock
              language="tsx"
              code={`<Scene key="cta">
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div>
      <h2 style={{ color: '#fff' }}>Ready to build?</h2>
      <a href="/docs" style={{ pointerEvents: 'auto', padding: '12px 28px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
        Get Started
      </a>
    </div>
  </div>
</Scene>`}
            />

            <h2>EngineOverlayHost</h2>
            <p>
              <code>ScenePlayer</code> renders an <code>EngineOverlayHost</code> automatically.
              When using the <code>EngineProvider</code> composition pattern, add{' '}
              <code>{'<EngineOverlayHost />'}</code> yourself alongside <code>{'<SceneCanvas />'}</code>:
            </p>
            <CodeBlock
              language="tsx"
              code={`import { EngineProvider, SceneCanvas, EngineOverlayHost } from '@brewsite/core';

<EngineProvider manifestUrl="/manifest.json">
  <Scene key="hero">
    <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} />
    <h1 style={{ position: 'absolute', top: 40, left: 40, color: '#fff' }}>Hello</h1>
  </Scene>

  <div style={{ position: 'relative', height: '100vh' }}>
    <SceneCanvas style={{ width: '100%', height: '100%' }} />
    <EngineOverlayHost />
  </div>
</EngineProvider>`}
            />
          </ProseBlock>
          <ScenePanel id="scene-hud" height="480px" plugins={DOCS_PLUGINS}>
            <SceneHudPanel />
          </ScenePanel>

          <ProseBlock id="hud-animejs-prose">
            <h1>Anime.js Presets</h1>
            <p>
              The <code>hud/animejs/</code> sub-module provides ready-made entrance animations for HUD
              items using anime.js. These are applied via the <code>animations</code> prop on{' '}
              <code>{'<HudItem>'}</code>.
            </p>
            <Callout type="note">
              anime.js is bundled with @brewsite/core — no additional install needed.
            </Callout>

            <h2>Available Presets</h2>
            <CodeBlock
              language="tsx"
              code={`import { fadeIn, slideUp, stagger } from '@brewsite/core/hud/animejs';

<HudItem id="title" animations={[fadeIn({ duration: 400, delay: 100 })]}>
  My Title
</HudItem>`}
            />

            <h2>fadeIn</h2>
            <p>Animates opacity from 0 to 1 when the HUD item becomes visible.</p>
            <CodeBlock
              language="tsx"
              code={`import { fadeIn } from '@brewsite/core/hud/animejs';

<HudItem
  id="headline"
  style={{ position: 'absolute', top: 40, left: 60 }}
  animations={[
    fadeIn({
      duration: 500,
      delay: 150,
      easing: 'easeOutQuad',
    }),
  ]}
>
  <h1>Scene Title</h1>
</HudItem>`}
            />

            <h2>slideUp</h2>
            <p>Translates the element upward from an offset position while fading in.</p>
            <CodeBlock
              language="tsx"
              code={`import { slideUp } from '@brewsite/core/hud/animejs';

<HudItem
  id="body-text"
  style={{ position: 'absolute', bottom: 80, left: 60 }}
  animations={[
    slideUp({
      distance: 24,
      duration: 400,
    }),
  ]}
>
  <p>Supporting copy goes here.</p>
</HudItem>`}
            />

            <h2>stagger</h2>
            <p>Apply a staggered delay across multiple sibling HUD items.</p>
            <CodeBlock
              language="tsx"
              code={`import { fadeIn, stagger } from '@brewsite/core/hud/animejs';

<Hud enabled>
  {['Feature A', 'Feature B', 'Feature C'].map((label, i) => (
    <HudItem
      key={label}
      id={\`feature-\${i}\`}
      style={{ position: 'absolute', top: 40 + i * 48, left: 60 }}
      animations={[
        fadeIn({
          duration: 350,
          delay: stagger(i, { base: 100, step: 80 }),
        }),
      ]}
    >
      {label}
    </HudItem>
  ))}
</Hud>`}
            />
            <Callout type="tip">
              Combine <code>slideUp</code> + <code>fadeIn</code> for a polished entrance effect.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-hud-animejs" height="480px" plugins={DOCS_PLUGINS}>
            <SceneHudAnimejsPanel />
          </ScenePanel>

          {/* ── Act 5: Input ─────────────────────────────────────────────── */}
          <ActHeader id="act-input" title="Input" />

          <ProseBlock id="input-navigation-prose">
            <h1>Scene Navigation</h1>
            <p>
              BrewSite supports two navigation modes: scroll-driven (the page scrolls to advance scenes)
              and direct mode (you control progress programmatically or via input events).
            </p>

            <h2>Scroll Mode (default)</h2>
            <p>
              Wrap <code>{'<ScenePlayer>'}</code> in <code>{'<EngineScrollRegion>'}</code> to enable
              scroll-driven navigation.
            </p>
            <CodeBlock
              language="tsx"
              code={`import { EngineScrollRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
          {scenes}
        </ScenePlayer>
      </div>
    </EngineScrollRegion>
  );
}`}
            />
            <PropTable
              rows={[
                { name: 'pixelsPerScene', type: 'number', required: false, defaultValue: '800', description: 'Scroll depth in pixels to advance one scene' },
              ]}
            />

            <h2>Direct Mode</h2>
            <p>
              Use <code>useEngineScrubber()</code> or <code>engine.scrollToProgress()</code> to drive
              progress directly without scroll:
            </p>
            <CodeBlock
              language="tsx"
              code={`import { useEngineScrubber } from '@brewsite/core';

function Controls() {
  const { progress, setProgress } = useEngineScrubber({ pixelsPerScene: 800 });
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={progress}
      onChange={e => setProgress(Number(e.target.value))}
    />
  );
}`}
            />
            <Callout type="note">
              <code>useEngineScrubber</code> must be rendered inside a <code>{'<ScenePlayer>'}</code>{' '}
              subtree. See <a href="#hooks-prose">Hooks Reference</a> for the full API.
            </Callout>

            <h2>Keyboard Navigation</h2>
            <p>
              ScenePlayer responds to <kbd>ArrowRight</kbd>/<kbd>ArrowLeft</kbd> by default when{' '}
              <code>keyboard: true</code> is set.
            </p>
            <CodeBlock
              language="tsx"
              code={`<ScenePlayer
  manifestUrl="/scene-manifest.json"
  keyboard
>
  {scenes}
</ScenePlayer>`}
            />

            <h2><code>SceneNavInputMap</code> Options</h2>
            <PropTable
              rows={[
                { name: 'mode', type: "'scroll' | 'direct'", required: false, defaultValue: 'scroll', description: 'Navigation mode' },
                { name: 'wheel.enabled', type: 'boolean', required: false, defaultValue: 'true', description: 'Whether mouse wheel advances scenes' },
                { name: 'drag.enabled', type: 'boolean', required: false, defaultValue: 'false', description: 'Whether drag gesture advances scenes' },
                { name: 'pixelsPerScene', type: 'number', required: false, defaultValue: '800', description: 'Scroll/drag pixels per scene advance' },
              ]}
            />
          </ProseBlock>
          <ScenePanel id="scene-input-navigation" height="480px" plugins={DOCS_PLUGINS}>
            <SceneInputNavigationPanel />
          </ScenePanel>

          <ProseBlock id="input-actions-prose">
            <h1>Input Actions</h1>
            <p>
              The action input system maps user gestures (pointer drag, mouse wheel, pinch) to named
              semantic actions. Built-in actions include camera orbit, dolly (zoom), pan, and reset.
            </p>

            <h2><code>InputController</code> and <code>Action</code> DSL</h2>
            <CodeBlock
              language="tsx"
              code={`<InputController>
  <Action
    type="camera.orbit"
    pointer={{ button: 0, drag: true }}
    touch={{ fingers: 1, drag: true }}
  />
  <Action
    type="camera.dolly"
    wheel={{ enabled: true }}
    touch={{ fingers: 2, pinch: true }}
  />
  <Action
    type="camera.reset"
    pointer={{ button: 1 }}
    key={{ code: 'KeyR' }}
  />
</InputController>`}
            />
            <PropTable
              rows={[
                { name: 'type', type: 'string', required: true, description: 'Semantic action name.' },
                { name: 'pointer', type: 'PointerMap', required: false, defaultValue: '—', description: 'Bind this action to a pointer (mouse/stylus) gesture' },
                { name: 'touch', type: 'TouchMap', required: false, defaultValue: '—', description: 'Bind this action to a touch gesture' },
                { name: 'wheel', type: 'WheelMap', required: false, defaultValue: '—', description: 'Bind this action to mouse wheel input' },
                { name: 'key', type: 'KeyMap', required: false, defaultValue: '—', description: 'Bind this action to a keyboard key' },
              ]}
            />

            <h2>Built-in Action Types</h2>
            <PropTable
              rows={[
                { name: 'camera.orbit', type: 'built-in', description: 'Rotate the camera around its target' },
                { name: 'camera.dolly', type: 'built-in', description: 'Zoom in/out' },
                { name: 'camera.reset', type: 'built-in', description: 'Reset camera to its DSL-defined position' },
                { name: 'camera.pan', type: 'built-in', description: 'Strafe the camera laterally' },
                { name: 'canvas.focus', type: 'built-in', description: 'Click to focus camera on a clicked object' },
              ]}
            />
            <Callout type="tip">
              Use <code>guard: true</code> on wheel actions whenever the page also uses scroll-driven
              scene navigation.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-input-actions" height="480px" plugins={DOCS_PLUGINS}>
            <SceneInputActionsPanel />
          </ScenePanel>

          {/* ── Act 6: Player & Hooks ────────────────────────────────────── */}
          <ActHeader id="act-player-hooks" title="Player &amp; Hooks" />

          <ProseBlock id="player-prose">
            <h1>ScenePlayer &amp; EngineProvider</h1>
            <p>
              The <code>ScenePlayer</code> component is the top-level React integration point. It manages
              the Three.js renderer, the widget tick loop, and the HUD overlay.
            </p>

            <h2>Props</h2>
            <PropTable
              rows={[
                { name: 'manifestUrl', type: 'string', required: true, description: 'URL to the generated scene-manifest.json (from gen:scene-dsl)' },
                { name: 'widgetSetup', type: '(manifest: AssetManifest) => WidgetRegistry', required: false, defaultValue: '—', description: 'Factory for the widget registry. Defaults to createDefaultWidgetRegistry(manifest).' },
                { name: 'quality', type: "'performance' | 'balanced' | 'high'", required: false, defaultValue: 'balanced', description: 'Pre-baked frame count preset' },
                { name: 'pixelsPerScene', type: 'number', required: false, defaultValue: '800', description: 'Scroll pixels allocated per scene for scroll-mode navigation' },
                { name: 'fpsCap', type: 'number', required: false, defaultValue: '60', description: 'Maximum frames per second for the render loop' },
                { name: 'onSceneChange', type: '(sceneId: string, sceneIndex: number) => void', required: false, defaultValue: '—', description: 'Called when the current scene changes' },
                { name: 'onReady', type: '() => void', required: false, defaultValue: '—', description: 'Called when all widgets are loaded and ready' },
                { name: 'onError', type: '(error: Error) => void', required: false, defaultValue: '—', description: 'Called on fatal errors' },
                { name: 'className', type: 'string', required: false, defaultValue: '—', description: 'CSS class applied to the root canvas container' },
              ]}
            />

            <h2>EngineScrollRegion</h2>
            <p>
              Wrap <code>ScenePlayer</code> in <code>EngineScrollRegion</code> to create a scroll spacer:
            </p>
            <CodeBlock
              language="tsx"
              code={`import { EngineScrollRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
          {scenes}
        </ScenePlayer>
      </div>
    </EngineScrollRegion>
  );
}`}
            />

            <h2>EngineInputRegion</h2>
            <p>
              Manages the <code>ActionInputController</code> lifecycle for camera interaction:
            </p>
            <CodeBlock
              language="tsx"
              code={`import { EngineScrollRegion, EngineInputRegion, ScenePlayer } from '@brewsite/core';

export default function Page() {
  return (
    <EngineScrollRegion pixelsPerScene={800}>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <EngineInputRegion>
          <ScenePlayer manifestUrl="/scene-manifest.json" pixelsPerScene={800}>
            {scenes}
          </ScenePlayer>
        </EngineInputRegion>
      </div>
    </EngineScrollRegion>
  );
}`}
            />

            <h2>TimelineWidget (Dev Tool)</h2>
            <CodeBlock
              language="tsx"
              code={`import { ScenePlayer, TimelineWidget } from '@brewsite/core';

<ScenePlayer manifestUrl="/scene-manifest.json">
  {scenes}
  {import.meta.env.DEV && <TimelineWidget />}
</ScenePlayer>`}
            />
            <Callout type="warning">
              Remove <code>TimelineWidget</code> before production. It adds visual overhead and is for
              development only.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-player" height="480px" plugins={DOCS_PLUGINS}>
            <ScenePlayerPanel />
          </ScenePanel>

          <ProseBlock id="hooks-prose">
            <h1>Hooks Reference</h1>
            <p>
              All hooks must be called from components rendered inside <code>{'<ScenePlayer>'}</code>.
              They read from React contexts provided by the player.
            </p>
            <Callout type="warning">
              Do not call these hooks outside of a <code>{'<ScenePlayer>'}</code> subtree. They will
              throw.
            </Callout>

            <h3><code>useSceneEngine()</code></h3>
            <p>Returns <code>{'{ progress, sceneId, sceneIndex, engine, state }'}</code>.</p>
            <CodeBlock
              language="tsx"
              code={`import { useSceneEngine } from '@brewsite/core';

function SceneDebug() {
  const { state, engine } = useSceneEngine();
  return (
    <div>
      <p>Scene: {state.sceneId}</p>
      <p>Progress: {state.progress.toFixed(3)}</p>
      <button onClick={() => engine.scrollToProgress(0)}>Reset</button>
    </div>
  );
}`}
            />

            <h3><code>useEngineState()</code></h3>
            <p>Returns <code>EngineState</code> (progress, sceneId, sceneIndex). Lighter than <code>useSceneEngine</code>.</p>
            <CodeBlock
              language="typescript"
              code={`const state = useEngineState();
// state.progress  — [0,1]
// state.sceneId   — current scene key
// state.sceneIndex — 0-indexed`}
            />

            <h3><code>useCurrentScene()</code></h3>
            <p>Returns <code>{'{ id: string, index: number }'}</code>.</p>
            <CodeBlock language="typescript" code={`const { id, index } = useCurrentScene();`} />

            <h3><code>useSceneProgress()</code></h3>
            <p>Returns <code>number</code> [0,1] within the current scene (not total progress).</p>
            <CodeBlock language="typescript" code={`const sceneProgress = useSceneProgress();`} />

            <h3><code>useEngineScrubber()</code></h3>
            <p>Returns <code>{'{ progress, setProgress }'}</code>. Used for direct-mode progress control.</p>
            <CodeBlock
              language="tsx"
              code={`import { useEngineScrubber } from '@brewsite/core';

function Scrubber() {
  const { progress, setProgress } = useEngineScrubber({ pixelsPerScene: 800 });
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={progress}
      onChange={e => setProgress(Number(e.target.value))}
    />
  );
}`}
            />

            <h3><code>useVariable&lt;T&gt;(namespace, key)</code></h3>
            <p>Reactive read of a <code>VariableStore</code> value.</p>
            <CodeBlock
              language="tsx"
              code={`import { useVariable } from '@brewsite/core';

function ActiveSceneLabel() {
  const sceneId = useVariable<string>('__scene_meta__', 'id');
  return <span>Active scene: {sceneId ?? '—'}</span>;
}`}
            />
          </ProseBlock>
          <ScenePanel id="scene-hooks" height="480px" plugins={DOCS_PLUGINS}>
            <SceneHooksPanel />
          </ScenePanel>

          {/* ── Act 7: Widget SDK ────────────────────────────────────────── */}
          <ActHeader id="act-widget-sdk" title="Widget SDK" />

          <ProseBlock id="widget-sdk-prose">
            <h1>Widget SDK Overview</h1>
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
                <code>onTick(dt, variables)</code> is called every animation frame.
              </li>
              <li>
                <strong>Apply</strong> — If the widget implements <code>IRenderable</code>,{' '}
                <code>apply(state, ctx)</code> is called every frame with the current pre-baked state
                sampled from the <code>SceneTrack</code>.
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
          </ProseBlock>
          <ScenePanel id="scene-widget-sdk" height="480px" plugins={DOCS_PLUGINS}>
            <SceneWidgetSdkPanel />
          </ScenePanel>

          <ProseBlock id="custom-widget-prose">
            <h1>Custom Widget</h1>
            <Callout type="tip">
              Custom widgets are the primary extension point in BrewSite. The toolkit&apos;s own built-in
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
              The component name passed to <code>registerNode</code> — <code>&apos;MyElement&apos;</code> here —
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
            <p>The built-in blend helpers available from <code>@brewsite/core</code>:</p>
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
          </ProseBlock>
          <ScenePanel id="scene-custom-widget" height="480px" plugins={DOCS_PLUGINS}>
            <SceneCustomWidgetPanel />
          </ScenePanel>

          <ProseBlock id="variable-store-prose">
            <h1>VariableStore</h1>
            <p>
              The <code>VariableStore</code> is a lightweight reactive key-value store for sharing
              state between widgets and React components. It&apos;s the bridge between the Three.js tick
              loop and your UI — widgets write into the store each frame, and React components read
              from it using a hook.
            </p>

            <h2>Writing to the Store (from a Widget)</h2>
            <CodeBlock
              language="typescript"
              code={`// Inside IAnimationController.onTick:
onTick(dt: number, variables: VariableStoreWriter): void {
  variables.set('my-widget', 'score', this.currentScore);
  variables.set('my-widget', 'health', this.currentHealth);
}`}
            />

            <h2>Reading in React</h2>
            <CodeBlock
              language="tsx"
              code={`import { useVariable } from '@brewsite/core';

function ScoreDisplay(): JSX.Element {
  const score = useVariable<number>('my-widget', 'score');
  return <div className="score">{score ?? 0}</div>;
}`}
            />
            <Callout type="note">
              <code>useVariable</code> returns <code>undefined</code> until the widget publishes its
              first value. Always provide a fallback (<code>?? 0</code>) when rendering.
            </Callout>

            <h2>Built-in Namespaces</h2>
            <PropTable
              rows={[
                { name: '__scene_meta__ / id', type: 'string', description: 'The key of the currently active scene.' },
                { name: '__scene_meta__ / index', type: 'number', description: 'Zero-based index of the currently active scene.' },
                { name: '__scene_meta__ / progress', type: 'number', description: 'Playback progress within the current scene, in the range [0, 1].' },
              ]}
            />

            <h2>VariableStoreReader (read-only)</h2>
            <p>
              Inside <code>IRenderable.apply</code>, variables are available read-only via{' '}
              <code>WidgetRenderContext.variables</code>:
            </p>
            <CodeBlock
              language="typescript"
              code={`apply(state: MyState, ctx: WidgetRenderContext): void {
  const score = ctx.variables.get<number>('my-widget', 'score');
  if (score !== undefined) {
    this.mesh.scale.setScalar(1 + score * 0.1);
  }
}`}
            />
            <Callout type="tip">
              The separation between <code>VariableStoreWriter</code> (in <code>onTick</code>) and{' '}
              <code>VariableStoreReader</code> (in <code>apply</code>) is intentional. It keeps the
              write path explicit and prevents accidental mutation during the render pass.
            </Callout>
          </ProseBlock>
          <ScenePanel id="scene-variable-store" height="480px" plugins={DOCS_PLUGINS}>
            <SceneVariableStorePanel />
          </ScenePanel>

          <ProseBlock id="widget-registry-prose">
            <h1>Widget Registry</h1>
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
          </ProseBlock>
          <ScenePanel id="scene-widget-registry" height="480px" plugins={DOCS_PLUGINS}>
            <SceneWidgetRegistryPanel />
          </ScenePanel>

          {/* ── Act 8: Reference ─────────────────────────────────────────── */}
          <ActHeader id="act-reference" title="Reference" />

          <ProseBlock id="api-reference-prose">
            <h1>API Reference</h1>
            <p>
              Full TypeScript API documentation for <code>@brewsite/core</code>, organized by module.
              All public interfaces, types, and functions are documented with TSDoc annotations in source.
            </p>
            <Callout type="note">
              The interactive API reference is generated from source TSDoc annotations. The sections
              below provide a manual summary of the full public surface.
            </Callout>

            <h2>DSL Components</h2>
            <p>
              Imported from <code>@brewsite/core</code>. All DSL components return <code>null</code>{' '}
              — they register state with the compiler via <code>registerNode</code> and have no
              runtime render output of their own.
            </p>
            <table className="prop-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Import</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>&lt;Scene&gt;</code></td><td>@brewsite/core</td><td>Scene keyframe container.</td></tr>
                <tr><td><code>&lt;Camera&gt;</code></td><td>@brewsite/core</td><td>Camera position and lens configuration. See <a href="#camera-prose">Camera Element</a>.</td></tr>
                <tr><td><code>&lt;Lighting&gt;</code></td><td>@brewsite/core</td><td>Scene lighting container. See <a href="#lighting-prose">Lighting Element</a>.</td></tr>
                <tr><td><code>&lt;Background&gt;</code></td><td>@brewsite/core</td><td>Scene background color. See <a href="#background-prose">Background Element</a>.</td></tr>
                <tr><td><code>&lt;Floor&gt;</code></td><td>@brewsite/core</td><td>Reflective ground plane. See <a href="#floor-prose">Floor Element</a>.</td></tr>
                <tr><td><code>&lt;Environment&gt;</code></td><td>@brewsite/core</td><td>HDR environment map. See <a href="#environment-prose">Environment Element</a>.</td></tr>
                <tr><td><code>&lt;Hud&gt;</code></td><td>@brewsite/core</td><td>HUD overlay container. See <a href="#hud-prose">Overlay Content</a>.</td></tr>
                <tr><td><code>&lt;HudItem&gt;</code></td><td>@brewsite/core</td><td>Individual HUD overlay item. See <a href="#hud-prose">Overlay Content</a>.</td></tr>
                <tr><td><code>&lt;InputController&gt;</code></td><td>@brewsite/core</td><td>Action input container. See <a href="#input-actions-prose">Actions</a>.</td></tr>
                <tr><td><code>&lt;Action&gt;</code></td><td>@brewsite/core</td><td>Single input action mapping. See <a href="#input-actions-prose">Actions</a>.</td></tr>
              </tbody>
            </table>

            <h2>Player &amp; Hooks</h2>
            <table className="prop-table">
              <thead>
                <tr><th>Export</th><th>Signature</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>ScenePlayer</code></td><td><code>React.FC&lt;ScenePlayerProps&gt;</code></td><td>Root player component. See <a href="#player-prose">ScenePlayer</a>.</td></tr>
                <tr><td><code>EngineScrollRegion</code></td><td><code>React.FC</code></td><td>Scroll-aware container that maps document scroll position to scene progress.</td></tr>
                <tr><td><code>EngineInputRegion</code></td><td><code>React.FC</code></td><td>Pointer/keyboard event capture region.</td></tr>
                <tr><td><code>useSceneEngine</code></td><td><code>() =&gt; SceneEngine</code></td><td>Access the engine imperatively.</td></tr>
                <tr><td><code>useCurrentScene</code></td><td><code>() =&gt; {'{'}id: string; index: number{'}'}</code></td><td>Returns the active scene key and zero-based index.</td></tr>
                <tr><td><code>useSceneProgress</code></td><td><code>() =&gt; number</code></td><td>Returns playback progress within the current scene [0, 1].</td></tr>
                <tr><td><code>useVariable&lt;T&gt;</code></td><td><code>(ns: string, key: string) =&gt; T | undefined</code></td><td>Subscribe to a VariableStore value. See <a href="#variable-store-prose">VariableStore</a>.</td></tr>
                <tr><td><code>createDefaultWidgetRegistry</code></td><td><code>(manifest) =&gt; WidgetRegistry</code></td><td>Creates a registry with all built-in widgets. See <a href="#widget-registry-prose">WidgetRegistry</a>.</td></tr>
              </tbody>
            </table>

            <h2>Widget SDK</h2>
            <table className="prop-table">
              <thead>
                <tr><th>Interface / Symbol</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>IWidget</code></td><td>Base interface. Requires <code>widgetId</code>, <code>initialize</code>, <code>dispose</code>.</td></tr>
                <tr><td><code>ISceneElement</code></td><td>DSL compilation. Requires <code>compileNode</code>, <code>buildTransitionSpec</code>.</td></tr>
                <tr><td><code>IRenderable</code></td><td>Three.js rendering. Requires <code>apply(state, ctx)</code>.</td></tr>
                <tr><td><code>ILoadable</code></td><td>Async asset loading. Requires <code>load(ctx)</code>, <code>assetsReady</code>.</td></tr>
                <tr><td><code>IAnimationController</code></td><td>Per-frame updates. Requires <code>onTick(dt, variables)</code>.</td></tr>
                <tr><td><code>IVariableProvider</code></td><td>Publishes variables to the store. Requires <code>getVariables()</code>.</td></tr>
                <tr><td><code>CUSTOM_NODE_HANDLER</code></td><td>Symbol used to register a custom nested DSL handler.</td></tr>
              </tbody>
            </table>
          </ProseBlock>
          <ScenePanel id="scene-api-reference" height="480px" plugins={DOCS_PLUGINS}>
            <SceneApiReferencePanel />
          </ScenePanel>

          <ProseBlock id="timeline-prose">
            <h1>Timeline &amp; Math</h1>
            <p>
              The timeline module defines the algebra for scene frames, tick counts, and progress
              mapping. The math module provides vector and color utilities used by the compiler and
              widget render layer. Both are exported from <code>@brewsite/core</code>.
            </p>

            <h2><code>SceneTimeline</code> Type</h2>
            <CodeBlock
              language="typescript"
              code={`interface SceneTimeline {
  framesPerTick: number;  // animation frames between sampled ticks
  ticksPerScene: number;  // number of ticks to bake per scene transition
  sceneCount: number;     // total number of scenes
  // Derived:
  totalTicks: number;     // ticksPerScene * sceneCount
}`}
            />

            <h2><code>createSceneTimeline(sceneCount, options?)</code></h2>
            <CodeBlock
              language="typescript"
              code={`import { createSceneTimeline } from '@brewsite/core';

// Balanced quality (default)
const timeline = createSceneTimeline(3);

// High quality — more ticks means smoother easing curves
const highQuality = createSceneTimeline(3, {
  framesPerTick: 60,
  ticksPerScene: 60,
});

// Performance mode — fewer ticks, smaller footprint
const perf = createSceneTimeline(3, {
  framesPerTick: 120,
  ticksPerScene: 15,
});`}
            />
            <PropTable
              rows={[
                {
                  name: 'framesPerTick',
                  type: 'number',
                  defaultValue: '60',
                  description: 'Number of animation frames between sampled ticks.',
                },
                {
                  name: 'ticksPerScene',
                  type: 'number',
                  defaultValue: '30',
                  description: 'Number of pre-baked ticks per scene transition.',
                },
              ]}
            />
            <Callout type="note">
              In most cases you don&apos;t need to call <code>createSceneTimeline</code> directly.{' '}
              <code>ScenePlayer</code> creates one internally using the <code>quality</code> prop.
            </Callout>

            <h2>Math Utilities</h2>
            <h3><code>blendNumber(a, b, t)</code></h3>
            <p>Linear interpolation between two numbers.</p>
            <h3><code>blendColor(a, b, t)</code></h3>
            <p>CSS color string interpolation through the LAB color space.</p>
            <h3><code>blendOpacity(a, b, t)</code></h3>
            <p>Opacity interpolation, clamped to [0, 1].</p>
            <h3><code>blendVec3(a, b, t)</code></h3>
            <p>Three.js <code>Vector3</code> linear interpolation. Returns a new <code>Vector3</code>.</p>
            <CodeBlock
              language="typescript"
              code={`import { blendNumber, blendColor, blendOpacity, blendVec3 } from '@brewsite/core';
import * as THREE from 'three';

const mid = blendNumber(0, 100, 0.5);   // → 50
const color = blendColor('#ff6600', '#0066ff', 0.5);  // → LAB midpoint
const opacity = blendOpacity(0, 1, 0.75);  // → 0.75
const posA = new THREE.Vector3(0, 0, 5);
const posB = new THREE.Vector3(0, 2, -3);
const pos  = blendVec3(posA, posB, 0.5);   // → (0, 1, 1)`}
            />

            <h2>Easing</h2>
            <p>
              The blend helpers perform linear interpolation. To apply easing, pre-process the{' '}
              <code>t</code> value before passing it to a blend function:
            </p>
            <CodeBlock
              language="typescript"
              code={`function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const mySpec: ElementTransitionSpec<MyState> = {
  position: {
    blend: (a, b, t) => blendVec3(a, b, easeInOut(t)),
    default: DEFAULT_POSITION,
  },
};`}
            />
          </ProseBlock>
          <ScenePanel id="scene-timeline" height="480px" plugins={DOCS_PLUGINS}>
            <SceneTimelinePanel />
          </ScenePanel>
        </main>
      </div>
    </NavProvider>
  );
}
