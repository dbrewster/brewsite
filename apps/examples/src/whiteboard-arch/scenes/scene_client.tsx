import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Lighting,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import { DiagramCanvas, darkGlassTheme } from '@brewsite/diagram';
import { MidFade } from '@brewsite/core/hud/animejs';
import { makeWhiteboardDiagram } from '../diagram';

export const sceneClient: JSX.Element = (
  <Scene id="whiteboard-client">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera mode="world" position={[-15, -8, 30]} target={[-15, -8, 0]} fov={45} />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      position={[0, 2, 0]}
      rotation={[0, 0, 0]}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>
    <TextBox id="client-callout" x={0.02} y={0.75} w={0.35} h={0.2}>
      <div style={{
        padding: '20px 24px',
        background: 'rgba(3, 5, 8, 0.88)',
        backdropFilter: 'blur(16px)',
        borderRadius: '4px',
        borderLeft: '3px solid #cc3333',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        <MidFade duration={800}>
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: '#cc3333',
            marginBottom: '8px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Client Area
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.55,
          }}>
            WA (Web Agent) and FC (Flow Controller) connect via Pchain to FW Cloud
          </div>
        </MidFade>
      </div>
    </TextBox>
  </Scene>
);
