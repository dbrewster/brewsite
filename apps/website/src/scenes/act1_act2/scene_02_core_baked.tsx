import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { Fade, SlideUp } from '@brewsite/core/hud/animejs';

const tags = ['Declarative', 'Scroll-Driven', 'SSR-Safe', 'TypeScript-First', 'O(1) Sampling'];

export const scene02CoreBaked: JSX.Element = (
  <Scene id="website-core-02">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0.5, 0]} fov={65} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.1} color="#000510" />
      <Directional intensity={0.55} color="#0088ff" position={[4, 10, 6]} />
    </Lighting>
    <div style={{
      position: 'absolute',
      bottom: '12%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: 680,
      textAlign: 'center',
    }}>
      <Fade duration={900}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(240,246,252,0.4)',
          marginBottom: 14,
        }}>
          Pre-baked. Zero runtime cost.
        </div>
      </Fade>
      <SlideUp duration={1000} delay={100}>
        <p style={{
          fontSize: 'clamp(20px, 2.5vw, 28px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 22,
        }}>
          The compiler bakes every transition frame.<br />
          Playback is O(1). Always.
        </p>
      </SlideUp>
      <SlideUp duration={900} delay={220}>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              padding: '5px 14px',
              borderRadius: 4,
              border: '1px solid rgba(0,245,255,0.28)',
              background: 'rgba(0,245,255,0.07)',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.07em',
              color: '#00f5ff',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </SlideUp>
    </div>
  </Scene>
);
