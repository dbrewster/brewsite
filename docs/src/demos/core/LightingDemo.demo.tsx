import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// Scene 1: ambient only — soft, flat illumination
<Scene key="ambient" id="ambient">
  <Lighting>
    <Ambient color="#ffffff" intensity={0.6} />
  </Lighting>
</Scene>

// Scene 2: ambient + directional — adds directional highlights
<Scene key="directional" id="directional">
  <Lighting>
    <Ambient color="#ffffff" intensity={0.3} />
    <Directional color="#ffeedd" intensity={1.2} position={[5, 8, 5]} />
  </Lighting>
</Scene>

// Scene 3: cool blue lighting
<Scene key="blue" id="blue">
  <Lighting>
    <Ambient color="#2244bb" intensity={0.5} />
    <Directional color="#6699ff" intensity={1.0} position={[-5, 8, 5]} />
  </Lighting>
</Scene>

// Scene 4: warm golden lighting
<Scene key="warm" id="warm">
  <Lighting>
    <Ambient color="#ffaa33" intensity={0.4} />
    <Directional color="#ffddaa" intensity={1.5} position={[5, 10, 0]} />
  </Lighting>
</Scene>
`.trim();

export default function LightingDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={4}>
      <Scene key="ambient" id="ambient">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.6} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.4} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="directional" id="directional">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.3} />
          <Directional color="#ffeedd" intensity={1.2} position={[5, 8, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="blue" id="blue">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#2244bb" intensity={0.5} />
          <Directional color="#6699ff" intensity={1.0} position={[-5, 8, 5]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <Scene key="warm" id="warm">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffaa33" intensity={0.4} />
          <Directional color="#ffddaa" intensity={1.5} position={[5, 10, 0]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.5} />
        </Floor>
      </Scene>
    </DemoScene>
  );
}
