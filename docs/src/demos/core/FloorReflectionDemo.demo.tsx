import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
  FloorMirror,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// Scene 1: no floor surface — just geometry lighting
<Scene key="no-floor" id="no-floor">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
  </Lighting>
</Scene>

// Scene 2: subtle physical floor — low opacity, high roughness (matte)
<Scene key="subtle" id="subtle">
  <Floor enabled>
    <FloorPhysical opacity={0.3} metalness={0.2} roughness={0.8} />
  </Floor>
</Scene>

// Scene 3: reflective mirror floor — high opacity, very low roughness
<Scene key="reflective" id="reflective">
  <Floor enabled>
    <FloorMirror
      mirrorOpacity={0.9}
      mirrorResolution={512}
      mirrorClipBias={0.003}
    />
  </Floor>
</Scene>
`.trim();

export default function FloorReflectionDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={3}>
      <Scene key="no-floor" id="no-floor">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
      </Scene>

      <Scene key="subtle" id="subtle">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.3} metalness={0.2} roughness={0.8} />
        </Floor>
      </Scene>

      <Scene key="reflective" id="reflective">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.5} />
          <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorMirror
            mirrorOpacity={0.9}
            mirrorResolution={512}
            mirrorClipBias={0.003}
          />
        </Floor>
      </Scene>
    </DemoScene>
  );
}
