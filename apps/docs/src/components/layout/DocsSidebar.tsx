// Docs sidebar — reads active section from NavContext, not from engine registry.
// Sidebar is outside any SceneEngine — uses NavContext for all engine-independent nav.

import { type JSX } from 'react';
import { useNavContext } from '../../nav/NavContext';
import { docsNav } from '../../nav/docs-nav';
import type { NavSection, NavItem } from '../../nav/types';

export function DocsSidebar(): JSX.Element {
  const { activeSectionId, scrollToSection } = useNavContext();

  return (
    <aside className="docs-sidebar">
      <div className="docs-sidebar__brand">
        <span className="doc-header__brand">BrewSite</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 4, fontWeight: 400 }}>
          Docs
        </span>
      </div>

      {docsNav.map((section: NavSection) => (
        <div key={section.title} className="nav-section">
          <div className="nav-section__title">{section.title}</div>
          {section.items.map((item: NavItem) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item nav-item--button${
                activeSectionId === item.id ? ' nav-item--active' : ''
              }`}
              onClick={() => item.id && scrollToSection(item.id, item.progress)}
              aria-current={activeSectionId === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
