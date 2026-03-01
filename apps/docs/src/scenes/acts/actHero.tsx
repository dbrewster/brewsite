import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  Floor,
  FloorPhysical,
  ProgressManager,
} from '@brewsite/core';

export function ActHeroScene(): JSX.Element {
  return (
    <Scene key="docs-hero" id="docs-hero">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 2.2, 7]} target={[0, 1, 0]} fov={45} />
      <Background color="#0a0a14" />
      <Lighting>
        <Ambient color="#6060ff" intensity={0.4} />
        <Directional color="#ffffff" intensity={2.0} position={[3, 8, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.6} roughness={0.4} />
      </Floor>

      {/* Centered hero card — accounts for sidebar width */}
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
          gap: 0,
        }}
      >
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(120,130,255,0.7)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Documentation
        </p>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            lineHeight: 1.1,
            textShadow: '0 2px 32px rgba(0,0,0,0.6)',
          }}
        >
          BrewSite
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(14px, 1.8vw, 20px)',
            color: 'rgba(220,220,255,0.75)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          TypeScript + React + Three.js framework for animated 3D experiences
        </p>
        <p
          style={{
            marginTop: 40,
            fontSize: 12,
            color: 'rgba(180,180,255,0.4)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.1em',
          }}
        >
          scroll to explore ↓
        </p>
      </div>
    </Scene>
  );
}
