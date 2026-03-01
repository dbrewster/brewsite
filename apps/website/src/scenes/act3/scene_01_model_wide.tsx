import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import { ModelRouter } from '@brewsite/model';
import { MidFade, SlideUp, Fade } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';

const CAM_POS: Vec3 = isMobile ? [0, 8, 28] : [0, 8, 38];
const CAM_FOV = isMobile ? 65 : 55;

export const scene01ModelWide: JSX.Element = (
  <Scene id="website-model-01">
    <ProgressManager
      scrollUnits={2400}
      autoAdvance={{ duration: 9, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera mode="world" position={CAM_POS} target={[0, 5, 0]} fov={CAM_FOV} />

    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0a1428"
        mirrorOpacity={0.38}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#e0e8ff" />
      <Directional intensity={0.9} color="#ffffff" position={[5, 20, 22]} />
      <Directional intensity={0.4} color="#0066ff" position={[-8, 6, 10]} />
    </Lighting>
    <ModelRouter
      type="Worker"
      id="worker-wide"
      scale={0.2}
      position={[0, 0, 0]}
      rotation={[0, 0.2, 0]}
    />

    {/* Phase 1: Drop a GLTF headline */}
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

    {/* Phase 2: PBR materials detail */}
    <div style={{
      position: 'absolute',
      top: '8%',
      right: '5%',
      textAlign: 'right' as const,
      maxWidth: 300,
    }}>
      <Fade duration={900}>
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
      </Fade>
      <SlideUp duration={1000} delay={80}>
        <div style={{
          fontSize: 'clamp(18px, 2.5vw, 24px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 8,
        }}>
          Physically Based.<br />Floor-to-ceiling.
        </div>
      </SlideUp>
      <SlideUp duration={900} delay={200}>
        <div style={{
          fontSize: 'clamp(13px, 1.5vw, 15px)',
          color: 'rgba(240,246,252,0.55)',
          lineHeight: 1.6,
        }}>
          Metalness, roughness, normals —<br />
          the renderer handles it.<br />
          You handle the story.
        </div>
      </SlideUp>
    </div>
  </Scene>
);
