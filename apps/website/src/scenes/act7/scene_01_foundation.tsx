import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager, TextBox,
} from '@brewsite/core';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

export const scene01Foundation: JSX.Element = (
  <Scene id="website-full-01" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1600}
      fn={dwellFn}
      autoAdvance={{ duration: 6, max: 0.85, pauseOnScroll: true }}
    />
    <Camera
      mode="nvsViewport"
      worldScale={50}
    />

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
    <TextBox key="foundation-overlay" x={0.1} y={0.2} w={0.8} h={0.6}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        textAlign: 'center',
      }}>
        <div>
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
            One engine.<br />Infinite forms.
          </h2>
        </div>
      </div>
    </TextBox>
  </Scene>
);
