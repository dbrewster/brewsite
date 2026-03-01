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

export function ActElementsScene(): JSX.Element {
  return (
    <Scene key="act-elements" id="act-elements">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.5} />
        <Directional color="#88ccff" intensity={2.0} position={[-5, 10, 3]} />
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
            color: 'rgba(80,160,255,0.8)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Chapter 3
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
          Elements
        </h2>
      </div>
    </Scene>
  );
}
