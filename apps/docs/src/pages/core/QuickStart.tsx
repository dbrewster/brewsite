import { JSX } from 'react';
import { Link } from 'react-router';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Callout } from '../../components/ui/Callout';
import { LiveDemo } from '../../components/demo/LiveDemo';
import MultiSceneDemo, { CODE as MULTI_SCENE_CODE } from '../../demos/core/MultiSceneDemo.demo';

export default function QuickStart(): JSX.Element {
  return (
    <section>
      <h1>Quick Start</h1>

      <Callout type="tip">
        You'll have a running 3D animation scene in about 15 minutes.
      </Callout>

      <h2>Step 1: Install</h2>

      <p>
        Install <code>@brewsite/core</code> and its peer dependencies:
      </p>

      <CodeBlock
        language="bash"
        code="npm install @brewsite/core three react react-dom"
      />

      <h2>Step 2: Create the Widget Registry</h2>

      <p>
        The <strong>widget registry</strong> tells BrewSite which renderable concepts are active in
        your scene. <code>createDefaultWidgetRegistry</code> bundles all built-in widgets: Camera,
        Lighting, Background, Environment, Floor, Model, and SceneMeta. You pass it a manifest
        object for GLTF model loading — use <code>null</code> if you have no models yet.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { createDefaultWidgetRegistry } from '@brewsite/core';

// No model assets for this example — pass null
const registry = createDefaultWidgetRegistry(null);`}
      />

      <h2>Step 3: Author Your First Scene</h2>

      <p>
        Scenes are pure declarations of state — what the camera sees, how the scene is lit, what
        background color is showing. You don't write animation math. You describe snapshots, and the
        compiler figures out how to animate between them.
      </p>

      <p>
        Place DSL element components as children of <code>&lt;Scene&gt;</code>. Each{' '}
        <code>&lt;Scene&gt;</code> needs a stable <code>key</code> prop — this is how the compiler
        identifies which scenes to interpolate between.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { Scene, Camera, Lighting, Ambient, Directional, Background, Floor, FloorPhysical } from '@brewsite/core';

function MyScenes() {
  return (
    <>
      <Scene key="intro">
        <Camera
          mode="world"
          position={[0, 2, 8]}
          target={[0, 0, 0]}
        />
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
        <Camera
          mode="orbit"
          target={[0, 0, 0]}
          azimuth={1.0}
          polar={1.2}
          distance={6}
        />
        <Background color="#1a0a2a" />
      </Scene>
    </>
  );
}`}
      />

      <Callout type="note">
        Elements not declared in a scene <strong>inherit from the previous scene</strong>. In the
        example above, <code>Lighting</code> and <code>Floor</code> carry forward from{' '}
        <code>intro</code> to <code>detail</code> — you only need to specify what changes.
      </Callout>

      <h2>Step 4: Mount ScenePlayer</h2>

      <p>
        <code>ScenePlayer</code> is the top-level React component. It mounts a Three.js canvas,
        drives the render loop, and compiles your scene JSX into a <code>SceneTrack</code> on first
        render. Pass your widget registry via the <code>widgetSetup</code> prop and a{' '}
        <code>manifestUrl</code> pointing to your asset manifest JSON (needed for model loading;
        for scenes with no models the file can be empty: <code>{'{}'}</code>).
      </p>

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

      <p>
        By default, <code>ScenePlayer</code> accepts a <code>progress</code> value you drive
        manually. To wire it to the browser scroll position, wrap the player in{' '}
        <code>EngineScrollRegion</code>. The region listens for scroll events and maps them to
        scene progress, making the 3D sequence scroll-driven with zero extra code.
      </p>

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

      <p>
        The <code>pixelsPerScene</code> prop controls how many pixels of scroll correspond to one
        full scene transition. 800px is a good starting point — increase it for slower, more
        deliberate transitions.
      </p>

      <h2>Live Result</h2>

      <p>
        Here's the full three-scene sequence from the demo running in the docs. Use the controls to
        step through scenes or let it auto-play:
      </p>

      <LiveDemo title="Three scenes, one ScenePlayer" code={MULTI_SCENE_CODE}>
        <MultiSceneDemo />
      </LiveDemo>

      <h2>Next Steps</h2>

      <ul>
        <li>
          <Link to="/core/scene-dsl">Learn the Scene DSL</Link> — all elements, all props
        </li>
        <li>
          <Link to="/core/concepts">Core Concepts</Link> — understand the compiler and widget system
        </li>
        <li>
          <Link to="/core/model">Add a 3D Model</Link> — load and animate a GLTF asset
        </li>
      </ul>
    </section>
  );
}
