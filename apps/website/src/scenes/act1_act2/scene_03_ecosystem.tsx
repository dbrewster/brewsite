import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [0.5, 1.0] as [number, number], enter: [0.5, 1.0] as [number, number] };

const PACKAGES = [
  {
    name: '@brewsite/core',
    headline: 'The engine.',
    body: 'Declarative scenes. Pre-baked transitions. O(1) playback.',
    soon: false,
  },
  {
    name: '@brewsite/model',
    headline: 'GLTF models.',
    body: 'Characters, animations, PBR materials. Drop in any GLTF.',
    soon: false,
  },
  {
    name: '@brewsite/diagram',
    headline: '3D diagrams.',
    body: 'Architecture, flows, systems. Themes and routed edges.',
    soon: false,
  },
  {
    name: '@brewsite/chart',
    headline: 'Data stories.',
    body: 'Charts and visualizations in 3D.',
    soon: true,
  },
] as const;

export const scene03Ecosystem: JSX.Element = (
  <Scene id="website-ecosystem-01" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={2000}
      fn={dwellFn}
      autoAdvance={{ duration: 8, max: 0.85, pauseOnScroll: true }}
    />
    <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.08} color="#000510" />
      <Directional intensity={0.4} color="#0066ff" position={[3, 8, 5]} />
      <Directional intensity={0.2} color="#00aaff" position={[-5, 4, 3]} />
    </Lighting>

    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px',
      boxSizing: 'border-box',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(0,245,255,0.6)',
          marginBottom: 14,
          textAlign: 'center' as const,
        }}>
          The Ecosystem
        </div>
        <h2 style={{
          fontSize: 'clamp(28px, 6vw, 52px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center' as const,
          marginBottom: 32,
        }}>
          One engine.<br />Four packages.
        </h2>
      </MidFade>

      <div className="ecosystem-grid">
        {PACKAGES.map((pkg, i) => (
          <ScrollOn key={pkg.name} duration={800} delay={i * 110}>
            <div className="ecosystem-card">
              <div className="ecosystem-card__name">{pkg.name}</div>
              <div className="ecosystem-card__headline">{pkg.headline}</div>
              <div className="ecosystem-card__body">{pkg.body}</div>
              {pkg.soon && (
                <div className="ecosystem-card__soon">↗ coming soon</div>
              )}
            </div>
          </ScrollOn>
        ))}
      </div>

      <ScrollOn duration={900} delay={550}>
        <p style={{
          marginTop: 28,
          fontSize: 'clamp(12px, 1.5vw, 14px)',
          color: 'rgba(240,246,252,0.38)',
          textAlign: 'center' as const,
          maxWidth: 380,
          lineHeight: 1.6,
        }}>
          Install only what you need. All packages share the same declarative scene model.
        </p>
      </ScrollOn>
    </div>
  </Scene>
);
