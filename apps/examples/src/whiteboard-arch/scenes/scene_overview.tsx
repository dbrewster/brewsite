import type { JSX } from 'react';
import {
  Ambient,
  Camera,
  Background,
  Directional,
  Lighting,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import { DiagramCanvas, darkGlassTheme } from '@brewsite/diagram';
import { makeWhiteboardDiagram } from '../diagram';

export const sceneOverview: JSX.Element = (
  <Scene id="whiteboard-overview">
    <ProgressManager scrollUnits={2500} />
    <Camera mode="world" position={[7, 2, 88]} target={[7, 2, 0]} fov={54} />
    <Background color="#0d1117" />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#6688cc" position={[-20, 10, 10]} />
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

    <TextBox id="overview-title" x={0.03} y={0.03} w={0.32} h={0.14}>
      <div style={{
        padding: '14px 18px',
        background: 'rgba(13,17,23,0.82)',
        backdropFilter: 'blur(12px)',
        borderLeft: '3px solid rgba(200,200,200,0.35)',
        borderRadius: '2px',
      }}>
        <div style={{ fontFamily: 'system-ui', fontSize: '10px', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(200,200,200,0.45)', marginBottom: 5 }}>
          Network Security Architecture
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '16px', fontWeight: 700,
          color: '#f0f6fc', marginBottom: 7 }}>
          Full Overview
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'rgba(240,246,252,0.55)' }}>
          <span style={{ color: '#cc3333' }}>■</span> Current&nbsp;&nbsp;
          <span style={{ color: '#3366cc' }}>■</span> Future&nbsp;&nbsp;
          <span style={{ color: '#33aa66' }}>■</span> Control Plane
        </div>
      </div>
    </TextBox>
  </Scene>
);
