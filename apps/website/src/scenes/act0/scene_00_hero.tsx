import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorMirror,
} from '@brewsite/core';
import { NeonSign } from '../../widgets/neon-sign';
import { HeroSection } from '../../landing/hero/HeroSection';

export const scene00Hero: JSX.Element = (
  <Scene id="website-hero-00">
    <Camera mode="world" position={[0, 7, 17]} target={[0, 1.4, 0]} fov={52} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.2} color="#09111f" />
      <Directional intensity={0.4} color="#9ed7ff" position={[8, 12, 12]} />
      <Directional intensity={0.3} color="#ffb366" position={[-12, 10, 6]} />
    </Lighting>
    <Floor enabled position={[0, 1, 0]} rotationRelative={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#050910"
        mirrorOpacity={0.2}
        mirrorResolution={1024}
        mirrorClipBias={0.003}
      />
    </Floor>
    <NeonSign
      enabled
      text="BrewSite"
      fontUrl="/fonts/DancingScript-Bold.woff"
      position={[0, 0, 0]}
      rotation={[-Math.PI/8, 0, 0]}
      scale={1}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={1}
    />
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      <HeroSection />
    </div>
  </Scene>
);
