import type {JSX} from 'react';
import {Background, Camera, Floor, FloorMirror, Lighting, ProgressManager, Scene} from '@brewsite/core';
import {NeonSign} from '../../widgets/neon-sign';
import {HeroBezel} from '../../landing/hero/HeroBezel';
import {ScrollIndicator} from '../../landing/hero/ScrollIndicator';
import {isMobile} from '../../utils/viewport';
import {dwellFn} from '../../utils/pacing';

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
    </Lighting>
    <Background color="#050910" opacity={1} cssSize="cover" cssPosition="center" />
    <Floor enabled position={[0, 0, 0]}>
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
      x={0.2} y={0.35} w={0.6} h={0.3}
      z={0}
      tilt={-Math.PI / 8}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={1.3}
    />
    <div key="hero-overlay" style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      <section className="hero-section">
        <HeroBezel />

        {/* Beat 2: Positioning statement */}
        <div className="hero-statement">
          <span className="hero-statement__eyebrow">The React toolkit for</span>
          <h1 className="hero-statement__headline">3D storytelling.</h1>
          <span className="hero-statement__tagline">Scenes as React. Rendered like film.</span>
        </div>

        {/* Beat 3: Package badges */}
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

        {/* Beat 4: Scroll indicator */}
        <ScrollIndicator />
      </section>
    </div>
  </Scene>
);
