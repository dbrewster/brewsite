import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, Hud, HudItem } from '@brewsite/core';
import { ScrollOn } from '@brewsite/core/hud/animejs';

export const scene03HudIsReact: JSX.Element = (
  <Scene id="website-libraries-01">
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.1} color="#000820" />
      <Directional intensity={0.4} color="#00aaff" position={[5, 8, 5]} />
      <Directional intensity={0.3} color="#aa00ff" position={[-5, 6, 3]} />
    </Lighting>
    <Hud>
      <HudItem id="hud-react-hud">
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
            <ScrollOn duration={1200}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(170,0,255,0.7)',
                marginBottom: 16,
              }}>
                HUD is just React
              </div>
              <h2 style={{
                fontSize: 'clamp(32px, 4.5vw, 50px)',
                fontWeight: 700,
                lineHeight: 1.15,
                color: '#f0f6fc',
                marginBottom: 18,
              }}>
                Any library.<br />Any component.<br />Any animation system.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(240,246,252,0.6)', lineHeight: 1.6 }}>
                HudItems are React subtrees. Use anime.js, Framer Motion, Recharts,
                live data feeds — if it renders in React, it renders in the HUD.
              </p>
            </ScrollOn>
          </div>
        </div>
      </HudItem>
    </Hud>
  </Scene>
);
