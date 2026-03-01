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

export function ActSceneAuthoringScene(): JSX.Element {
  return (
    <Scene key="act-scene-authoring" id="act-scene-authoring">
      <ProgressManager scrollUnits={600} />
      <Camera mode="world" position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={42} />
      <Background color="#0f0d1a" />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.4} />
        <Directional color="#ff88ff" intensity={1.5} position={[-4, 8, 4]} />
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
            color: 'rgba(180,100,255,0.8)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Chapter 2
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
          Scene Authoring
        </h2>
      </div>
    </Scene>
  );
}
