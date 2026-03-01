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

export function ActGettingStartedScene(): JSX.Element {
  return (
    <Scene key="act-getting-started" id="act-getting-started">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 1.8, 9]} target={[0, 0.8, 0]} fov={40} />
      <Background color="#0d0f1a" />
      <Lighting>
        <Ambient color="#4466ff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.8} position={[4, 10, 6]} />
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
            color: 'rgba(100,120,255,0.8)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Chapter 1
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
          Getting Started
        </h2>
      </div>
    </Scene>
  );
}
