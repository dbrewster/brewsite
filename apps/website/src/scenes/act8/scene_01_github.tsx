import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional } from '@brewsite/core';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const GITHUB_URL = 'https://github.com/brewsite/brewsite';

export const scene01Github: JSX.Element = (
  <Scene id="website-github-01" transition={LATE_FADE}>
    <Camera mode="nvsViewport" worldScale={50} />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.2} color="#08101d" />
      <Directional intensity={0.35} color="#00aaff" position={[4, 8, 6]} />
    </Lighting>
    <div key="github-overlay" style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto',
    }}>
      <section className="github-section">
        <div className="terminal-card">
          <div className="terminal-card__bar">
            <span className="terminal-card__dot terminal-card__dot--red" />
            <span className="terminal-card__dot terminal-card__dot--yellow" />
            <span className="terminal-card__dot terminal-card__dot--green" />
            <span className="terminal-card__title">terminal</span>
          </div>
          <div className="terminal-card__body">
            <div className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__command">{' '}pnpm add @brewsite/core @brewsite/model @brewsite/diagram</span>
            </div>
            <div className="terminal-card__output">added 3 packages in 1.2s</div>
            <div style={{ marginTop: 10 }} className="terminal-card__line">
              <span className="terminal-card__prompt">$</span>
              <span className="terminal-card__cursor" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="github-cta-block">
          <h2 className="github-cta-block__headline">Open Source. Production Ready.</h2>
          <p className="github-cta-block__body">
            Built for TypeScript. Powered by React.<br />
            The engine is @brewsite/core. The rest is what your story needs.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="github-cta-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.929.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Star on GitHub →
          </a>
        </div>
      </section>
    </div>
  </Scene>
);
