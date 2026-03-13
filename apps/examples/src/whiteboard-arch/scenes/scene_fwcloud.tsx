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

export const SceneFwCloud = () => (
  <Scene id="whiteboard-fwcloud">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera mode="world" position={[-13, 11, 36]} target={[-13, 11, 0]} fov={48} />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[10, 20, 30]} />
      <Directional intensity={0.3} color="#334466" position={[-20, 5, 10]} />
    </Lighting>
    {makeWhiteboardDiagram()}
    <TextBox id="fwcloud-callout" x={0.02} y={0.72} w={0.42} h={0.24}>
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
            FW Cloud
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(240, 246, 252, 0.85)',
            lineHeight: 1.55,
          }}>
            ZSL and PA live inside FW Cloud. Green EDL connections bring in future control-plane additions: FW URL Update, App Catalog, PEAS.
          </div>
        </MidFade>
      </div>
    </TextBox>
  </Scene>
);
