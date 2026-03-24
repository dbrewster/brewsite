import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
  useCurrentScene,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// useCurrentScene() reads the active scene id and index from the engine state.
// It must be called inside a component rendered within <SceneEngine>.
function SceneInfoOverlay(): JSX.Element {
  const { id, index } = useCurrentScene();
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      background: 'rgba(0,0,0,0.5)', padding: '8px 14px',
      borderRadius: 6, color: '#fff', fontSize: 13, fontFamily: 'monospace'
    }}>
      scene: {id} ({index})
    </div>
  );
}

// Render the overlay as a sibling to Scene elements inside DemoScene:
<DemoScene sceneCount={2}>
  <Scene key="intro" id="intro"> ... </Scene>
  <Scene key="detail" id="detail"> ... </Scene>
  <SceneInfoOverlay />
</DemoScene>
`.trim();

function SceneInfoOverlay(): JSX.Element {
  const { id, index } = useCurrentScene();
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'rgba(0,0,0,0.5)',
      padding: '8px 14px',
      borderRadius: 6,
      color: '#fff',
      fontSize: 13,
      fontFamily: 'monospace',
    }}>
      scene: {id} ({index})
    </div>
  );
}

export default function VariableStoreDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={2}>
      <Scene key="intro" id="intro">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      <Scene key="detail" id="detail">
        <Camera mode="orbit" target={[0, 0, 0]} azimuth={"1.2rad"} polar={"1.1rad"} distance={6} />
        <Lighting>
          <Ambient color="#4488ff" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
        </Floor>
      </Scene>

      <SceneInfoOverlay />
    </DemoScene>
  );
}
