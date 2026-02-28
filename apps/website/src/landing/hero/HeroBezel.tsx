import type { JSX } from 'react';

export function HeroBezel(): JSX.Element {
  const rivets = Array.from({ length: 7 }, (_, i) => i);

  return (
    <div className="hero-bezel" aria-hidden="true">
      {/* Border layer */}
      <div className="hero-bezel__border" />

      {/* Corner L-brackets */}
      <div className="hero-bezel__corner hero-bezel__corner--tl" />
      <div className="hero-bezel__corner hero-bezel__corner--tr" />
      <div className="hero-bezel__corner hero-bezel__corner--bl" />
      <div className="hero-bezel__corner hero-bezel__corner--br" />

      {/* Rivet rows */}
      <div className="hero-bezel__rivets hero-bezel__rivets--top">
        {rivets.map((i) => <span key={i} className="rivet" />)}
      </div>
      <div className="hero-bezel__rivets hero-bezel__rivets--bottom">
        {rivets.map((i) => <span key={i} className="rivet" />)}
      </div>
    </div>
  );
}
