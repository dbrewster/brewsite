import { JSX } from 'react';
import { NavLink } from 'react-router';
import type { NavSection } from '../../nav/types';

interface DocSidebarProps {
  nav: NavSection[];
}

export function DocSidebar({ nav }: DocSidebarProps): JSX.Element {
  return (
    <aside className="doc-sidebar">
      {nav.map((section) => (
        <div key={section.title} className="nav-section">
          <div className="nav-section__title">{section.title}</div>
          {section.items.map((item) => (
            item.path !== undefined && (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
              >
                {item.label}
              </NavLink>
            )
          ))}
        </div>
      ))}
    </aside>
  );
}
