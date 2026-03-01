import type { JSX, ReactNode } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorMirror,
  ProgressManager,
  useEngineState,
} from '@brewsite/core';
import { NeonSign } from '../../widgets/neon-sign';
import { HeroBezel } from '../../landing/hero/HeroBezel';
import { ScrollIndicator } from '../../landing/hero/ScrollIndicator';

/**
 * Fades children in as blockProgress advances from `start` to `end`.
 * Replaces CSS animation-delay-based reveal — driven by BrewSite progress instead.
 */
function HeroFade({
  children,
  start,
  end,
}: {
  children: ReactNode;
  start: number;
  end: number;
}): JSX.Element {
  // sceneProgress is the local [0..1] progress within this scene only.
  // (useSceneProgress() returns global progress — wrong for per-scene fades.)
  const { sceneProgress } = useEngineState();
  const opacity = Math.max(0, Math.min(1, (sceneProgress - start) / Math.max(end - start, 0.001)));
  return <div style={{ opacity }}>{children}</div>;
}

export const scene00Hero: JSX.Element = (
  <Scene id="website-hero-00">
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 3, max: 0.80, pauseOnScroll: true }}
      animationTimeScale={5}
    />
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
      <section className="hero-section">
        <HeroBezel />
        <HeroFade start={0.35} end={0.55}>
          <div className="hero-content hero-content--below-sign">
            <p className="hero-tagline">Author in JSX. Ship to any surface.</p>
            <div className="hero-packages">
              <span className="hero-package-badge">@brewsite/core</span>
              <span className="hero-package-badge">@brewsite/diagram</span>
            </div>
          </div>
        </HeroFade>
        <HeroFade start={0.50} end={0.65}>
          <ScrollIndicator />
        </HeroFade>
      </section>
    </div>
  </Scene>
);
