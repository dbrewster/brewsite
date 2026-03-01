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

export function ActOverlayContentScene(): JSX.Element {
  return (
    <Scene key="act-overlay-content" id="act-overlay-content">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#140a0a" />
      <Lighting>
        <Ambient color="#ff4444" intensity={0.3} />
        <Directional color="#ffaa44" intensity={1.8} position={[6, 8, 2]} />
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
            color: 'rgba(255,150,80,0.8)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Chapter 4
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
          Overlay Content
        </h2>
      </div>
    </Scene>
  );
}
