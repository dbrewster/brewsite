import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, SlideUp } from '@brewsite/core/hud/animejs';
import { NeonSign } from '../../widgets/neon-sign';
import { dwellFn } from '../../utils/pacing';

export const scene01CoreIntro: JSX.Element = (
  <Scene id="website-core-01">
    <ProgressManager
      scrollUnits={1600}
      fn={dwellFn}
      autoAdvance={{ duration: 6, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.15} color="#000a20" />
      <Directional intensity={0.5} color="#0066ff" position={[3, 8, 5]} />
      <Directional intensity={0.25} color="#ff5500" position={[-5, 4, 3]} />
    </Lighting>
    <NeonSign enabled={false} opacity={0} intensity={0} />
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 620, padding: '0 24px' }}>
        <MidFade duration={1400}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(0,245,255,0.6)',
            marginBottom: 18,
          }}>
            @brewsite/core
          </div>
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 58px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 20px',
          }}>
            Scenes as React.<br />Rendered like film.
          </h2>
        </MidFade>
        <SlideUp duration={1000} delay={200}>
          <p style={{
            fontSize: 18,
            lineHeight: 1.65,
            color: 'rgba(240,246,252,0.6)',
            maxWidth: 480,
            margin: '0 auto',
          }}>
            Declare 3D scene states. Let the compiler handle transitions.
            No animation loops. No frame math. Just describe what you want.
          </p>
        </SlideUp>
      </div>
    </div>
  </Scene>
);
