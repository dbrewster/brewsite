import { JSX } from 'react';
import { NavLink } from 'react-router';
import { ThemeToggle } from '../ui/ThemeToggle';

interface DocHeaderProps {
  book: 'core' | 'diagram' | 'model';
}

export function DocHeader({ book }: DocHeaderProps): JSX.Element {
  return (
    <header className="doc-header">
      <span className="doc-header__logo">
        <span className="doc-header__brand">BrewSite</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 2 }}>Docs</span>
      </span>

      <nav className="doc-header__book-tabs" aria-label="Docs books">
        <NavLink
          to="/core/getting-started"
          className={`nav-book-tab${book === 'core' ? ' nav-book-tab--active' : ''}`}
        >
          @brewsite/core
        </NavLink>
        <NavLink
          to="/diagram/getting-started"
          className={`nav-book-tab${book === 'diagram' ? ' nav-book-tab--active' : ''}`}
        >
          @brewsite/diagram
        </NavLink>
        <NavLink
          to="/model/introduction"
          className={`nav-book-tab${book === 'model' ? ' nav-book-tab--active' : ''}`}
        >
          @brewsite/model
        </NavLink>
      </nav>

      <a
        href="https://github.com/your-org/brewsite"
        target="_blank"
        rel="noopener noreferrer"
        className="doc-header__github"
      >
        GitHub
      </a>
      <ThemeToggle />
    </header>
  );
}
