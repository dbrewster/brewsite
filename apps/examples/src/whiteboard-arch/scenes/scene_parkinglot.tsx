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

export const sceneParkingLot: JSX.Element = (
  <Scene id="whiteboard-parkinglot">
    <ProgressManager scrollUnits={2000} />
    <Background color="#0d1117" />
    <Camera mode="world" position={[7, 2, 88]} target={[7, 2, 0]} fov={54} />
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
    <TextBox id="parkinglot-overlay" x={0.25} y={0.1} w={0.50} h={0.80}>
      <div style={{
        padding: '32px 40px',
        background: 'rgba(3, 5, 8, 0.92)',
        backdropFilter: 'blur(24px)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        <MidFade duration={800}>
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'rgba(240, 246, 252, 0.45)',
            marginBottom: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Deferred Items
          </div>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 600,
            color: '#f0f6fc',
            margin: '0 0 24px',
            lineHeight: 1.2,
          }}>
            Parking Lot
          </h2>
          <ol style={{
            margin: 0,
            padding: '0 0 0 22px',
            listStyle: 'decimal',
          }}>
            {[
              'Letting folks have agency',
              'AI Spend',
              'Multiten for POC',
              'Tenant Monitoring / Alerting',
              'Deals lost',
              'Summer interns?',
              'Reasoning guardrails',
            ].map((item, i) => (
              <li key={i} style={{
                fontSize: '18px',
                color: 'rgba(240, 246, 252, 0.82)',
                lineHeight: 1.65,
                paddingLeft: '6px',
              }}>
                {item}
              </li>
            ))}
          </ol>
        </MidFade>
      </div>
    </TextBox>
  </Scene>
);
