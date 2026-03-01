import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror,
} from '@brewsite/core';
import { MidFade } from '@brewsite/core/hud/animejs';

export const scene01Foundation: JSX.Element = (
  <Scene id="website-full-01">
    <Camera mode="world" position={[0, 12, 55]} target={[0, 4, 0]} fov={58} />

    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#060a18"
        mirrorOpacity={0.25}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.25} color="#e0eaff" />
      <Directional intensity={0.7} color="#ffffff" position={[0, 25, 30]} />
      <Directional intensity={0.3} color="#0055ff" position={[-15, 10, 10]} />
      <Directional intensity={0.25} color="#ff3300" position={[15, 5, 10]} />
    </Lighting>
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <MidFade duration={1500}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'rgba(0,245,255,0.5)',
            marginBottom: 16,
          }}>
            BrewSite
          </div>
          <h2 style={{
            fontSize: 'clamp(36px, 5.5vw, 62px)',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(135deg, #f0f6fc 0%, #00f5ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            One framework.<br />Every medium.
          </h2>
        </div>
      </MidFade>
    </div>
  </Scene>
);
