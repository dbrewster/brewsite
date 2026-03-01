import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// HTML children inside <Scene> become overlay content rendered above the 3D canvas.
// Use position: absolute to place elements over the canvas area.
// Each scene can have completely different overlay content.
<Scene key="s1" id="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
    Scene One
  </div>
</Scene>

<Scene key="s2" id="s2">
  {/* Different overlay content appears on scene transition */}
  <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
    Scene Two — Overlay Active
  </div>
  <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
    Text overlays appear on scene transition
  </div>
</Scene>
`.trim();

export default function HudOverlayDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={2}>
      <Scene key="s1" id="s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
        {/* Scene 1 overlay — no content, canvas is empty */}
        <div style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
          Scene One
        </div>
      </Scene>

      <Scene key="s2" id="s2">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#4488ff" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
        </Floor>
        {/* Scene 2 overlay — HTML children appear over the 3D canvas */}
        <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
          Scene Two — Overlay Active
        </div>
        <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
          Text overlays appear on scene transition
        </div>
      </Scene>
    </DemoScene>
  );
}
