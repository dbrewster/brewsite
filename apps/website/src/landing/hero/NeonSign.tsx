import type { JSX } from 'react';
import './hero.css';

export function NeonSign(): JSX.Element {
  return (
    <div className="neon-sign-wrapper" aria-label="BrewSite">
      {/* Diffuse outer glow layer (blurred, wide) */}
      <svg
        className="neon-svg neon-svg--glow-outer"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="none"
          stroke="#00f5ff"
          strokeWidth="10"
        >
          BrewSite
        </text>
      </svg>

      {/* Mid glow layer */}
      <svg
        className="neon-svg neon-svg--glow-mid"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="none"
          stroke="#00f5ff"
          strokeWidth="4"
        >
          BrewSite
        </text>
      </svg>

      {/* Main crisp text layer */}
      <svg
        className="neon-svg neon-svg--main"
        viewBox="0 0 700 130"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="350"
          y="102"
          textAnchor="middle"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="105"
          fill="#00f5ff"
          stroke="#00f5ff"
          strokeWidth="1"
        >
          BrewSite
        </text>
      </svg>
    </div>
  );
}
