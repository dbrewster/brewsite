import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import { ModelRouter } from '@brewsite/model';
import { MidFade } from '@brewsite/core/hud/animejs';

export const scene01ModelWide: JSX.Element = (
  <Scene id="website-model-01">
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera mode="world" position={[0, 8, 38]} target={[0, 5, 0]} fov={55} />

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
      scale={.2}
      position={[0, 0, 0]}
      rotation={[0, 0.2, 0]}
    />
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
          textTransform: 'uppercase',
          color: 'rgba(240,246,252,0.4)',
          marginBottom: 10,
        }}>
          @brewsite/core · Model Element
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc' }}>
          Drop a GLTF.<br />Get a scene.
        </div>
      </MidFade>
    </div>
  </Scene>
);
