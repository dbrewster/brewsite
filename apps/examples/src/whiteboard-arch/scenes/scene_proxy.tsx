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
import { MidFade } from '@brewsite/core/hud/animejs';
import { makeWhiteboardDiagram } from '../diagram';

export const SceneProxy = () => (
  <Scene id="whiteboard-proxy">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera mode="world" position={[3, 8, 32]} target={[3, 8, 0]} fov={46} />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    {makeWhiteboardDiagram()}
    <TextBox id="proxy-callout" x={0.02} y={0.70} w={0.45} h={0.26}>
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
            Proxy / MITM (Current)
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.55,
          }}>
            NLB routes ports 8443/4128/443/80 into the Proxy(S3) Pod. RUST MITM intercepts traffic. Parsolib handles parsing. Hook Policy (JWT) shown in blue is the future auth mechanism.
          </div>
        </MidFade>
      </div>
    </TextBox>
  </Scene>
);
