import type { JSX } from 'react';
import { NeonSignCanvas } from './NeonSignCanvas';
import { NeonSign } from './NeonSign';
import { HeroBezel } from './HeroBezel';
import { ScrollIndicator } from './ScrollIndicator';

export function HeroSection(): JSX.Element {
  return (
    <section className="hero-section" id="hero">
      {/* Three.js metallic room — full bleed background */}
      <NeonSignCanvas />

      {/* Bezel frame overlay */}
      <HeroBezel />

      {/* Main content */}
      <div className="hero-content">
        <NeonSign />

        <p className="hero-tagline">Author in JSX. Ship to any surface.</p>

        <div className="hero-packages">
          <span className="hero-package-badge">@brewsite/core</span>
          <span className="hero-package-badge">@brewsite/diagram</span>
        </div>
      </div>

      {/* Scroll prompt */}
      <ScrollIndicator />
    </section>
  );
}
