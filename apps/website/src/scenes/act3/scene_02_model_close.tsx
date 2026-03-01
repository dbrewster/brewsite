import type { JSX } from 'react';
import {
  Scene, Camera, Background, Lighting, Ambient, Directional,
  Floor, FloorMirror, ModelRouter,
} from '@brewsite/core';
import { Fade, SlideUp } from '@brewsite/core/hud/animejs';

export const scene02ModelClose: JSX.Element = (
  <Scene id="website-model-02">
    <Camera mode="world" position={[3, 16, 20]} target={[0, 14, 0]} fov={45} />

    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0a1428"
        mirrorOpacity={0.3}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.3} color="#dce8ff" />
      <Directional intensity={1.1} color="#ffffff" position={[3, 22, 18]} />
      <Directional intensity={0.55} color="#ff6600" position={[8, 5, 6]} />
      <Directional intensity={0.3} color="#0033ff" position={[-6, 8, 8]} />
    </Lighting>
    <ModelRouter
      type="Worker"
      id="worker-close"
      position={[0, 0, 0]}
      rotation={[0, 0.15, 0]}
    />
    <div style={{
      position: 'absolute',
      top: '8%',
      right: '5%',
      textAlign: 'right',
      maxWidth: 320,
    }}>
      <Fade duration={900}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(255,102,0,0.7)',
          marginBottom: 10,
        }}>
          GLTF · PBR Materials
        </div>
      </Fade>
      <SlideUp duration={1000} delay={80}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc', lineHeight: 1.3, marginBottom: 10 }}>
          Physically Based.<br />Floor-to-ceiling.
        </div>
      </SlideUp>
      <SlideUp duration={900} delay={200}>
        <div style={{ fontSize: 14, color: 'rgba(240,246,252,0.55)', lineHeight: 1.6 }}>
          Metalness, roughness, normals — the renderer handles it.
          You handle the story.
        </div>
      </SlideUp>
    </div>
  </Scene>
);
