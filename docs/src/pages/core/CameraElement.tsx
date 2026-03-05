import type { ReactElement } from 'react';
import { Section, DocsDemo, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';
import { CameraWorldDemo } from '../../demos/core/CameraWorldDemo.demo';
import { CameraOrbitDemo } from '../../demos/core/CameraOrbitDemo.demo';

const WORLD_SNIPPET = `<Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />`;

const ORBIT_SNIPPET = `<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={1.5}
  polar={1.2}
  distance={6}
/>`;

const FIT_BOT_HEIGHT_CODE = `<Camera
  mode="fitBotHeight"
  targetId="character"
  targetHeight={1.8}
  framingHeightPct={0.85}
/>`;

const FIT_FLOOR_DEPTH_CODE = `<Camera
  mode="fitFloorDepth"
  floorY={0}
  floorZMin={-4}
  floorZMax={4}
  lookAtZ={0}
/>`;

const INTERACTION_CODE = `<Camera
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
/>`;

export function CameraPage(): ReactElement {
  return (
    <Section<SectionId> id="camera" title="Camera">
      <p>
        The <code>&lt;Camera&gt;</code> element controls the Three.js perspective camera. It supports
        world-space positioning, orbit mode, and automatic model-framing modes. Every scene can declare
        a camera independently — the engine interpolates smoothly between positions when transitioning.
      </p>

      <h2>World Mode</h2>
      <p>
        World mode gives you explicit control: provide a 3D <code>position</code> and a <code>target</code>{' '}
        point the camera looks at. This is the most direct way to frame a specific area of your scene,
        and makes camera intent obvious when reading a scene file.
      </p>
      <DocsDemo title="World-space camera across three scenes" height={480}>
        <CameraWorldDemo />
      </DocsDemo>
      <CodeBlock code={WORLD_SNIPPET} language="tsx" />

      <h2>Orbit Mode</h2>
      <p>
        Orbit mode positions the camera on a sphere around a target using spherical coordinates.
        It is ideal for turntable animations and cinematic fly-arounds where you want smooth angular
        control without manually computing Cartesian coordinates.
      </p>
      <DocsDemo title="Orbital camera sweep" height={480}>
        <CameraOrbitDemo />
      </DocsDemo>
      <CodeBlock code={ORBIT_SNIPPET} language="tsx" />
      <Callout type="note">
        Azimuth and polar are in radians. Azimuth <code>0</code> = positive Z axis; it increases
        counter-clockwise when viewed from above. Polar <code>0</code> = overhead (north pole);
        <code>Math.PI / 2</code> = equator (eye-level).
      </Callout>

      <h2>fitBotHeight Mode</h2>
      <p>
        Automatically frames a model by its foot-to-top height. The camera solves for a position that
        fills <code>framingHeightPct</code> of the viewport with the model's full height. This frees you
        from manually retuning camera position whenever model scale or scene layout changes.
      </p>
      <CodeBlock code={FIT_BOT_HEIGHT_CODE} language="tsx" />
      <Callout type="note">
        Transitioning between <code>fitBotHeight</code> and <code>world</code>/<code>orbit</code> modes
        produces a hard cut at the midpoint rather than a smooth interpolation. This is because the
        world-space position is resolved at render time, not at compile time. For smooth cross-mode
        transitions, use <code>world</code> or <code>orbit</code> on both the outgoing and incoming scenes.
      </Callout>

      <h2>fitFloorDepth Mode</h2>
      <p>
        Frames the camera to fit a floor plane between <code>floorZMin</code> and <code>floorZMax</code>{' '}
        within the viewport. Useful when you have a fixed floor layout and want the camera to automatically
        fill the view with the full floor depth.
      </p>
      <CodeBlock code={FIT_FLOOR_DEPTH_CODE} language="tsx" />

      <h2>Lens Configuration</h2>
      <p>
        Lens props are declared flat on <code>&lt;Camera&gt;</code> alongside the positioning descriptor.
        Use <code>fov</code> for a simple degree-based field of view, or <code>focalLength</code> +{' '}
        <code>filmGauge</code> for a cinematic mm-based equivalent.
      </p>
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
      <p>
        The <code>exposure</code> prop controls the renderer's tone mapping exposure — higher values
        brighten the output, lower values darken it. This is applied globally to the rendered frame,
        not to individual lights.
      </p>
      <PropTable
        rows={[
          { name: 'exposure', type: 'number', defaultValue: '1.0', description: 'Renderer tone mapping exposure. Values above 1 brighten; below 1 darken.' },
        ]}
      />

      <h2>Interactive Camera</h2>
      <p>
        Enable user orbit, dolly, and pan by adding an <code>interaction</code> config to any camera scene.
        The interaction layer sits on top of the scene's declarative camera state — the user can manipulate
        the camera freely, and the engine restores the declared position when transitioning to the next scene.
      </p>
      <CodeBlock code={INTERACTION_CODE} language="tsx" />
      <Callout type="note">
        Interactive camera requires the <code>camera-controls</code> package. See Installation for setup
        instructions.
      </Callout>
      <p>
        For full action-mapped input (keyboard shortcuts, focus-on-click, custom orbit limits), see{' '}
        <a href="#input-actions">ActionInputController</a>.
      </p>
    </Section>
  );
}
