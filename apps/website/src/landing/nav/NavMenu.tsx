import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { useCurrentScene, useGoToScene } from '@brewsite/core';
import { WEBSITE_SECTIONS } from '../../content/siteMap';
import '../hero/hero.css';

export function NavMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const { id: currentSceneId } = useCurrentScene();
  const goToScene = useGoToScene();

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const handleNavClick = useCallback((sceneId: string) => {
    close();
    goToScene(sceneId);
  }, [close, goToScene]);

  return (
    <div style={{ pointerEvents: 'auto' }}>
      {/* Hamburger button */}
      <button
        className="nav-hamburger"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="nav-hamburger__line" />
        <span className="nav-hamburger__line" />
        <span className="nav-hamburger__line" />
      </button>

      {/* Overlay + drawer */}
      <div className={`nav-overlay${open ? ' nav-overlay--open' : ''}`}>
        {/* Backdrop */}
        <div className="nav-overlay__backdrop" onClick={close} />

        {/* Drawer */}
        <nav className="nav-overlay__drawer" aria-label="Site navigation">
          <button
            className="nav-overlay__close"
            onClick={close}
            aria-label="Close navigation menu"
          >
            ×
          </button>

          {WEBSITE_SECTIONS.map(({ navNumber, navLabel, sceneId }) => (
            <button
              key={sceneId}
              className="nav-link"
              onClick={() => handleNavClick(sceneId)}
              aria-current={sceneId === currentSceneId ? 'page' : undefined}
            >
              <span className="nav-link__num">{navNumber}</span>
              {navLabel}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
