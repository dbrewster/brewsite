import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [0.5, 1.0] as [number, number], enter: [0.5, 1.0] as [number, number] };

const tags = ['Declarative', 'Scroll-Driven', 'SSR-Safe', 'TypeScript-First', 'O(1) Sampling'];

export const scene02CoreBaked: JSX.Element = (
  <Scene id="website-core-02" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1600}
      fn={dwellFn}
      autoAdvance={{ duration: 6, max: 0.85, pauseOnScroll: true }}
    />
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
      {/* MidFade: visible by bp=0.5, stays visible through bp=1 */}
      <MidFade duration={800}>
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
      </MidFade>
      <ScrollOn duration={1000} delay={100}>
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
      </ScrollOn>
      <ScrollOn duration={900} delay={220}>
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
      </ScrollOn>
    </div>
  </Scene>
);
