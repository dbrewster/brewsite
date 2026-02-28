import { JSX } from 'react';
import { NavLink } from 'react-router';
import { ThemeToggle } from '../ui/ThemeToggle';

interface DocHeaderProps {
  book: 'core' | 'diagram';
}

export function DocHeader({ book }: DocHeaderProps): JSX.Element {
  return (
    <header className="doc-header">
      <span className="doc-header__logo">
        <strong>BrewSite</strong> Docs
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
