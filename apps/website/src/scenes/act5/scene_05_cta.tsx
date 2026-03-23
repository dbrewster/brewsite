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
import { getMessage } from '../../content/messaging';
import { getSection } from '../../content/siteMap';
import { OverlayColumn } from '../../landing/components/OverlayColumn';
import { CommandCard } from '../../landing/components/CommandCard';
import { SectionLabelRow } from '../../landing/components/SectionLabelRow';
import { isMobile } from '../../utils/viewport';
import { useCommandCopyTelemetry } from '../../telemetry/useCommandCopyTelemetry';

const SCROLL = isMobile ? 750 : 1000;
const MIRROR_RES = isMobile ? 512 : 1024;
const msg = getMessage('cta');
const section = getSection('cta')!;

/** CommandCard with telemetry wired in. */
function CtaCommandCard(): JSX.Element {
  const onCopy = useCommandCopyTelemetry();
  return (
    <CommandCard
      command={msg.headline}
      secondaryLabel="View on GitHub"
      secondaryHref="https://github.com/nicholasgriffintn/brewsite"
      onCopy={onCopy}
    />
  );
};

/**
 * Act 5: The Invitation.
 *
 * The neon sign returns — but warmer now, with amber glow underneath.
 * "npm create brewsite" is the dominant action.
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
      x={"15%"} y={"6%"} w={"70%"} h={"22%"}
      z={-4}
      tilt={0}
      color="#00f5ff"
      emissiveColor="#00d8ff"
      intensity={0.5}
      opacity={0.4}
    />

    {/* CTA — centered, warm */}
    <div key="cta-overlay" className="scene-overlay">
      <OverlayColumn tone="warm">
        <SectionLabelRow number={section.navNumber} label={section.navLabel} />
        <CtaCommandCard />
      </OverlayColumn>
    </div>
  </Scene>
);
