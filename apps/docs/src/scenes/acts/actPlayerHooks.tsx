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

export function ActPlayerHooksScene(): JSX.Element {
  return (
    <Scene key="act-player-hooks" id="act-player-hooks">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0a0e18" />
      <Lighting>
        <Ambient color="#3388ff" intensity={0.6} />
        <Directional color="#ffffff" intensity={2.2} position={[0, 12, 5]} />
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
          Chapter 6
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
          Player &amp; Hooks
        </h2>
      </div>
    </Scene>
  );
}
