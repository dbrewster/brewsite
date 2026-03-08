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

export const sceneControlPlane: JSX.Element = (
  <Scene id="whiteboard-controlplane">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera mode="world" position={[37, 3, 38]} target={[37, 3, 0]} fov={50} />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    <DiagramCanvas
      id="whiteboard-arch-canvas"
      x={0} y={0} w={1} h={1}
      tilt={0}
      scale={1.0}
      theme={darkGlassTheme}
    >
      {makeWhiteboardDiagram()}
    </DiagramCanvas>
    <TextBox id="controlplane-callout" x={0.02} y={0.68} w={0.50} h={0.28}>
      <div style={{
        padding: '20px 24px',
        background: 'rgba(3, 5, 8, 0.88)',
        backdropFilter: 'blur(16px)',
        borderRadius: '4px',
        borderLeft: '3px solid #3366cc',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        <MidFade duration={800}>
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: '#3366cc',
            marginBottom: '8px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Control Plane &amp; AI (Future)
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.55,
          }}>
            KONG API gateway (with x-change) routes HTTP to ATLAS. Kafka handles async messaging. GR and ISC downstream. Blue pipeline: inputs → compile → OpenAI for AI-driven reasoning. Supports JSON/XML/Protobuf.
          </div>
        </MidFade>
      </div>
    </TextBox>
  </Scene>
);
