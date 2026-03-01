import type { JSX } from 'react';
import { HeroBezel } from './HeroBezel';
import { ScrollIndicator } from './ScrollIndicator';

export function HeroSection(): JSX.Element {
  return (
    <section className="hero-section">
      {/* Bezel frame overlay */}
      <HeroBezel />

      {/* Tagline + package badges */}
      <div className="hero-content hero-content--below-sign">
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
