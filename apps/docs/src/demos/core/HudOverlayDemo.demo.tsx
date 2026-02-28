import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Floor,
  FloorPhysical,
  Hud,
  HudItem,
} from '@brewsite/core';
import { DemoScene } from '../shared/DemoScene';

export const CODE = `
// <Hud> wraps overlay content. enabled={false} hides all HudItems.
// <HudItem> is a positioned overlay container rendered above the 3D canvas.
<Scene key="s1">
  <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
  <Hud enabled={false}>
    <HudItem id="title" style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
      Scene One
    </HudItem>
  </Hud>
</Scene>

<Scene key="s2">
  <Hud enabled={true}>
    <HudItem id="title" style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
      Scene Two — HUD Active
    </HudItem>
    <HudItem id="subtitle" style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
      Text overlays appear on scene transition
    </HudItem>
  </Hud>
</Scene>
`.trim();

export default function HudOverlayDemo(): JSX.Element {
  return (
    <DemoScene sceneCount={2}>
      <Scene key="s1">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#ffffff" intensity={0.4} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
        </Floor>
        <Hud enabled={false}>
          <HudItem id="title" style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
            Scene One
          </HudItem>
        </Hud>
      </Scene>

      <Scene key="s2">
        <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
        <Lighting>
          <Ambient color="#4488ff" intensity={0.5} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
        </Floor>
        <Hud enabled={true}>
          <HudItem id="title" style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
            Scene Two — HUD Active
          </HudItem>
          <HudItem id="subtitle" style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
            Text overlays appear on scene transition
          </HudItem>
        </Hud>
      </Scene>
    </DemoScene>
  );
}
