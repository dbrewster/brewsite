import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  ProgressManager,
} from '@brewsite/core';

export function ActWidgetSdkScene(): JSX.Element {
  return (
    <Scene key="act-widget-sdk" id="act-widget-sdk">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#10080e" />
      <Lighting>
        <Ambient color="#cc44ff" intensity={0.4} />
        <Directional color="#ff88cc" intensity={1.8} position={[-3, 8, 5]} />
      </Lighting>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 260,
          pointerEvents: 'none',
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(200,80,255,0.8)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Chapter 7
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            textShadow: '0 2px 24px rgba(0,0,0,0.5)',
          }}
        >
          Widget SDK
        </h2>
      </div>
    </Scene>
  );
}
