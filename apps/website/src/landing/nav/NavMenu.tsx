import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import '../hero/hero.css';

const NAV_LINKS = [
  { num: '00', label: 'Hero',         anchor: '#hero' },
  { num: '01', label: 'The Core',     anchor: '#act-core' },
  { num: '02', label: 'Libraries',    anchor: '#act-libraries' },
  { num: '03', label: 'Models',       anchor: '#act-models' },
  { num: '04', label: 'The Meeting',  anchor: '#act-meeting' },
  { num: '05', label: 'Diagrams',     anchor: '#act-diagrams' },
  { num: '06', label: 'Architecture', anchor: '#act-arch' },
  { num: '07', label: 'Full Stack',   anchor: '#act-fullstack' },
  { num: '08', label: 'GitHub',       anchor: '#act-github' },
] as const;

export function NavMenu(): JSX.Element {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const handleNavClick = useCallback((anchor: string) => {
    close();
    const el = document.querySelector(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, [close]);

  return (
    <>
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

          {NAV_LINKS.map(({ num, label, anchor }) => (
            <button
              key={anchor}
              className="nav-link"
              onClick={() => handleNavClick(anchor)}
            >
              <span className="nav-link__num">{num}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
