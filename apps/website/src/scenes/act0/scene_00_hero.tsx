import type { JSX } from 'react';
import { Ambient, Background, Camera, Directional, Floor, FloorMirror, Lighting, ProgressManager, Scene } from '@brewsite/core';
import { NeonSign } from '../../widgets/neon-sign';
import { getMessage } from '../../content/messaging';
import { HeroBezel } from '../../landing/hero/HeroBezel';
import { ScrollIndicator } from '../../landing/hero/ScrollIndicator';
import { ProofRail } from '../../landing/components/ProofRail';
import { isMobile } from '../../utils/viewport';
import { dwellFn } from '../../utils/pacing';

const MIRROR_RES = isMobile ? 512 : 1024;
const msg = getMessage('hero');

export const Scene00Hero = (): JSX.Element => (
  <Scene id="website-hero-00">
    <ProgressManager
      scrollUnits={3600}
      fn={dwellFn}
      autoAdvance={{ duration: 3, max: 0.80, pauseOnScroll: true }}
      animationTimeScale={10}
    />
    <Camera
      mode="world"
      position={isMobile ? [0, 2, 12] : [0, 2, 10]}
      target={[0, 1.5, 0]}
      fov={isMobile ? "60deg" : "52deg"}
    />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.25} color="#0a1020" />
      <Directional intensity={0.6} color="#4488ff" position={[-8, 12, 10]} />
      <Directional intensity={0.3} color="#00d8ff" position={[10, 6, 8]} />
    </Lighting>
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#050910"
        mirrorOpacity={0.1}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>
    <NeonSign
      enabled
      text="BrewSite"
      fontUrl="/fonts/DancingScript-Bold.woff"
      x={"10%"} y={"10%"} w={"80%"} h={"35%"}
      z={-2}
      tilt={0}
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

        {/* Category-first hero copy */}
        <div className="hero-statement">
          <span className="hero-statement__eyebrow">{msg.eyebrow}</span>
          <h1 className="hero-statement__headline">{msg.headline}</h1>
          <span className="hero-statement__tagline">{msg.support}</span>
        </div>

        {/* Proof rail beneath support line */}
        {msg.proofRail && (
          <div className="hero-content hero-content--below-sign">
            <ProofRail items={msg.proofRail} />
          </div>
        )}

        {/* Scroll indicator */}
        <ScrollIndicator />
      </section>
    </div>
  </Scene>
);
