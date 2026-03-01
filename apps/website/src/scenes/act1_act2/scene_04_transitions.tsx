import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient } from '@brewsite/core';
import { SlideUp, ScrollOff } from '@brewsite/core/hud/animejs';

const transitionNames = ['Fade', 'MidFade', 'SlideUp', 'SlideDown', 'ScrollOn', 'ScrollOff'];

export const scene04Transitions: JSX.Element = (
  <Scene id="website-libraries-02">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.08} color="#000510" />
    </Lighting>
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
    }}>
      <ScrollOff duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.6)',
        }}>
          @brewsite/core/hud/animejs
        </div>
      </ScrollOff>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 480 }}>
        {transitionNames.map((name, i) => (
          <SlideUp key={name} duration={700} delay={i * 80}>
            <div style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: '1px solid rgba(0,245,255,0.22)',
              background: 'rgba(0,245,255,0.06)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              color: '#00f5ff',
              letterSpacing: '0.04em',
            }}>
              {name}
            </div>
          </SlideUp>
        ))}
      </div>
      <SlideUp duration={900} delay={600}>
        <p style={{ fontSize: 14, color: 'rgba(240,246,252,0.5)', textAlign: 'center', maxWidth: 360 }}>
          Scroll-driven. Anime.js under the hood. Import and use.
        </p>
      </SlideUp>
    </div>
  </Scene>
);
