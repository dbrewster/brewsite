import type { JSX } from 'react';
import {
  Ambient,
  Background,
  Camera,
  Directional,
  Floor,
  FloorMirror,
  Lighting,
  ProgressManager,
  Scene,
} from '@brewsite/core';
import { NeonSign } from '../../widgets/neon-sign';
import { isMobile } from '../../utils/viewport';

const SCROLL = isMobile ? 750 : 1000;
const MIRROR_RES = isMobile ? 512 : 1024;

/**
 * Act 5: The Invitation.
 *
 * The neon sign returns — but warmer now, with amber glow underneath.
 * The cyan is the same, but the world around it has changed.
 * You've been on a journey from cold mystery to warm invitation.
 *
 * "npm create brewsite" is the only text that matters.
 */
export const Scene05Cta = (): JSX.Element => (
  <Scene id="website-get-started">
    <ProgressManager scrollUnits={SCROLL} />
    <Camera
      mode="world"
      position={isMobile ? [0, 2, 14] : [0, 2, 11]}
      target={[0, 1.5, 0]}
      fov={isMobile ? "56deg" : "50deg"}
    />
    {/* Cyan returns, but with warm amber underneath — bookend with warmth */}
    <Lighting intensityScale={0.9}>
      <Ambient intensity={0.2} color="#120a08" />
      <Directional intensity={0.4} color="#00d8ff" position={[-6, 10, 10]} />
      <Directional intensity={0.3} color="#FFB84D" position={[6, 4, 8]} />
      <Directional intensity={0.15} color="#7B61FF" position={[0, 12, -4]} />
    </Lighting>
    <Background color="#0A0808" opacity={1} />
    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#0A0808"
        mirrorOpacity={0.08}
        mirrorResolution={MIRROR_RES}
        mirrorClipBias={0.003}
      />
    </Floor>

    {/* Neon sign returns — visual bookend */}
    <NeonSign
      enabled
      text="BrewSite"
      fontUrl="/fonts/DancingScript-Bold.woff"
      x={0.15} y={0.06} w={0.7} h={0.22}
      z={-4}
      tilt={0}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={0.5}
      opacity={0.4}
    />

    {/* CTA — centered, warm */}
    <div key="cta-overlay" className="scene-overlay">
      <div className="scene-overlay__content">
        <div className="terminal-card terminal-card--warm" style={{ textAlign: 'left', pointerEvents: 'auto' }}>
          <div className="terminal-card__bar">
            <span className="terminal-card__dot terminal-card__dot--red" />
            <span className="terminal-card__dot terminal-card__dot--yellow" />
            <span className="terminal-card__dot terminal-card__dot--green" />
          </div>
          <div className="terminal-card__body">
            <div className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__command">npm create brewsite</span>
            </div>
            <div className="terminal-card__output">&ensp;Created my-project</div>
            <div className="terminal-card__output">&ensp;Ready at localhost:5173</div>
            <div style={{ height: 10 }} />
            <div className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__cursor" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 28, pointerEvents: 'auto' }}>
          <a className="github-cta-button github-cta-button--warm"
            href="https://github.com/nicholasgriffintn/brewsite"
            target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  </Scene>
);
