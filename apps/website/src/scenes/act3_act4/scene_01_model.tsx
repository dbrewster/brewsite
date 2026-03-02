import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import type { Vec3 } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import { actorElements } from './meetingCharacters';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

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
      position={(isMobile ? [0, 22, 70] : [0, 34, 110]) as Vec3}
      target={[0, 0, 0]}
      fov={isMobile ? 60 : 48}
    />
    <Floor enabled position={[0, 0, -100]} rotation={[-Math.PI / 2, 0, 0]}>
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

    {/* Top-left: @brewsite/model headline */}
    <div style={{
      position: 'absolute',
      top: '8%',
      left: '5%',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(240,246,252,0.4)',
          marginBottom: 10,
        }}>
          @brewsite/model
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 28px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.25,
        }}>
          Drop a GLTF.<br />Animate the world.
        </div>
      </MidFade>
    </div>

    {/* Top-right: PBR materials detail */}
    <div style={{
      position: 'absolute',
      top: '8%',
      right: '5%',
      textAlign: 'right' as const,
      maxWidth: 300,
    }}>
      <MidFade duration={900}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(255,102,0,0.7)',
          marginBottom: 10,
        }}>
          GLTF · PBR Materials
        </div>
      </MidFade>
      <ScrollOn duration={1000} delay={80}>
        <div style={{
          fontSize: 'clamp(18px, 2.5vw, 24px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 8,
        }}>
          Physically Based.<br />Floor-to-ceiling.
        </div>
      </ScrollOn>
      <ScrollOn duration={900} delay={200}>
        <div style={{
          fontSize: 'clamp(13px, 1.5vw, 15px)',
          color: 'rgba(240,246,252,0.55)',
          lineHeight: 1.6,
        }}>
          Metalness, roughness, normals —<br />
          the renderer handles it.<br />
          You handle the story.
        </div>
      </ScrollOn>
    </div>

    {actorElements}
  </Scene>
);
