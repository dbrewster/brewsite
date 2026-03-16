import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import { isMobile } from '../../utils/viewport';
import { actorElements } from './meetingCharacters';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `<MaleDummy id="worker" scale={0.001}
  x={0.15} y={0} w={0.7} h={1}>
  <Playback>
    <Animation clipName="chat-talkandlaugh-m" weight={1} />
  </Playback>
</MaleDummy>`;

export const scene01ModelWide: JSX.Element = (
  <Scene id="website-model-01" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={2400}
      fn={dwellFn}
      autoAdvance={{ duration: 9, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera
      mode="world"
      position={isMobile ? [0, 2, 7] : [0, 1.5, 5]}
      target={[0, 0, 0]}
      fov={isMobile ? 55 : 48}
    />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#ffe9c4"
        mirrorOpacity={0.3}
        mirrorResolution={1024}
        mirrorClipBias={0.003}
        mirrorEnvironmentIntensity={0.7}
        mirrorUseEnvironmentBackground
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.5} color="#e6eeff" />
      <Directional intensity={0.7} color="#ffffff" position={[0, 20, 20]} />
      <Directional intensity={0.25} color="#aaccff" position={[-10, 8, 5]} />
    </Lighting>

    <div key="model-overlay" style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 420 }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.3em',
        textTransform: 'uppercase' as const,
        color: 'rgba(0,245,255,0.6)',
        marginBottom: 12,
      }}>
        @brewsite/model
      </div>
      <div style={{
        fontSize: 'clamp(20px, 3vw, 28px)',
        fontWeight: 600,
        color: '#f0f6fc',
        lineHeight: 1.25,
        marginBottom: 16,
      }}>
        One tag.<br />One fully lit character.
      </div>
      <pre style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 'clamp(11px, 1.2vw, 13px)',
        lineHeight: 1.7,
        color: '#00f5ff',
        background: 'rgba(0,245,255,0.04)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 6,
        padding: 16,
        maxWidth: 400,
        margin: '0 0 16px',
        whiteSpace: 'pre-wrap',
      }}>
        {snippetCode}
      </pre>
      <div style={{
        fontSize: 'clamp(13px, 1.5vw, 15px)',
        color: 'rgba(240,246,252,0.6)',
        lineHeight: 1.6,
      }}>
        Materials, shadows, environment — the renderer handles all of it.<br />
        Drop any GLTF. Animate the world.
      </div>
    </div>

    {actorElements}
  </Scene>
);
