import type {JSX, ReactNode} from 'react';
import {Ambient, Background, Camera, Directional, Floor, FloorMirror, Lighting, ProgressManager, Scene, useEngineState,} from '@brewsite/core';
import {NeonSign} from '../../widgets/neon-sign';
import {HeroBezel} from '../../landing/hero/HeroBezel';
import {ScrollIndicator} from '../../landing/hero/ScrollIndicator';
import {isMobile} from '../../utils/viewport';
import {dwellFn} from '../../utils/pacing';

/**
 * Fades children in as sceneProgress advances from `start` to `end`.
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
  const { sceneProgress } = useEngineState();
  const opacity = Math.max(0, Math.min(1, (sceneProgress - start) / Math.max(end - start, 0.001)));
  return <div style={{ opacity }}>{children}</div>;
}

const MIRROR_RES = isMobile ? 512 : 1024;

export const scene00Hero = (
  <Scene id="website-hero-00">
    <ProgressManager
      scrollUnits={3600}
      fn={dwellFn}
      autoAdvance={{ duration: 3, max: 0.80, pauseOnScroll: true }}
      animationTimeScale={10}
    />
    <Camera mode="world" position={[0, 7, 17]} target={[0, 0, 0]} fov={52} />

    <Lighting intensityScale={1}>
      {/*<Ambient intensity={0.2} color="#09111f" />*/}
    </Lighting>
    <Background color="#050910" opacity={1} cssSize="cover" cssPosition="center" />
    <Floor enabled position={[0, 1, 0]}>
      <FloorMirror
        mirrorColor="#050910"
        mirrorOpacity={0.2}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>
    <NeonSign
      enabled
      text="BrewSite"
      fontUrl="/fonts/DancingScript-Bold.woff"
      position={[0, 0, 0]}
      rotation={[-Math.PI / 8, 0, 0]}
      scale={1}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={1.3}
    />
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      <section className="hero-section">
        <HeroBezel />

        {/* Beat 2: Positioning statement — appears in upper bezel zone after sign is lit */}
        <HeroFade start={0.42} end={0.68}>
          <div className="hero-statement">
            <span className="hero-statement__eyebrow">The React toolkit for</span>
            <h1 className="hero-statement__headline">3D storytelling.</h1>
            <span className="hero-statement__tagline">Scenes as React. Rendered like film.</span>
          </div>
        </HeroFade>

        {/* Beat 3: Package badges */}
        <HeroFade start={0.52} end={0.78}>
          <div className="hero-content hero-content--below-sign">
            <div className="hero-packages">
              <span className="hero-package-badge">@brewsite/core</span>
              <span className="hero-package-badge">@brewsite/model</span>
              <span className="hero-package-badge">@brewsite/diagram</span>
              <span className="hero-package-badge hero-package-badge--soon">
                @brewsite/chart
                <span className="hero-package-badge__soon-label">↗ soon</span>
              </span>
            </div>
          </div>
        </HeroFade>

        {/* Beat 4: Scroll indicator */}
        <HeroFade start={0.43} end={1}>
          <ScrollIndicator />
        </HeroFade>
      </section>
    </div>
  </Scene>
);
