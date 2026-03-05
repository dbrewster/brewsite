import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { MultiSceneDemo } from '../../demos/core/MultiSceneDemo.demo';

export function QuickStartPage(): ReactElement {
  return (
    <Section<SectionId> id="quick-start" title="Quick Start">
      <Callout type="tip">
        You'll have a running 3D animation scene in about 15 minutes.
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

      <h2>Live Result</h2>
      <DocsDemo title="Three scenes, one ScenePlayer" height={480}>
        <MultiSceneDemo />
      </DocsDemo>

      <h2>Next Steps</h2>
      <ul>
        <li><a href="#scene-dsl">Learn the Scene DSL</a> — all elements, all props</li>
        <li><a href="#concepts">Core Concepts</a> — understand the compiler and widget system</li>
        <li><a href="#model">Add a 3D Model</a> — load and animate a GLTF asset</li>
      </ul>
    </Section>
  );
}
