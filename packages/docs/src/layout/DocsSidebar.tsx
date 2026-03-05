// Static-manifest sidebar — reads from DocsNav and highlights activeId.

import { type ReactElement } from 'react';
import type { DocsNav } from '../nav/types';

export interface DocsSidebarProps {
  nav: DocsNav<string>;
  activeId: string;
  onSectionClick: (id: string) => void;
}

/**
 * Fixed-position sidebar rendered from the static nav manifest.
 *
 * Layout:
 * - `position: sticky; top: 0; height: 100vh; overflow-y: auto` — stays in view on scroll.
 * - Group titles use `.nav-section__title` class.
 * - Section buttons use `.nav-item` class with `.nav-item--active` modifier on match.
 *
 * Active-section highlight:
 * - Compares each section id against `activeId` prop.
 * - Active item receives `aria-current="page"` for accessibility.
 *
 * Click-to-jump:
 * - Calls `onSectionClick(id)` → parent calls `scrollIntoView({ behavior: 'smooth' })`.
 */
export function DocsSidebar({
  nav,
  activeId,
  onSectionClick,
}: DocsSidebarProps): ReactElement {
  return (
    <aside
      className="docs-sidebar"
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        width: 'var(--sidebar-width, 260px)',
        background: 'var(--bg-sidebar, #111117)',
        borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        padding: '24px 0',
        flexShrink: 0,
      }}
    >
      {nav.groups.map((group) => (
        <div key={group.title} className="nav-section">
          <div
            className="nav-section__title"
            style={{
              padding: '4px 20px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #55556a)',
              marginTop: 16,
            }}
          >
            {group.title}
          </div>
          {group.sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`nav-item nav-item--button${isActive ? ' nav-item--active' : ''}`}
                onClick={() => onSectionClick(section.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 20px',
                  fontSize: 14,
                  color: isActive
                    ? 'var(--text-primary, #e4e4f0)'
                    : 'var(--text-secondary, #8888aa)',
                  background: isActive ? 'var(--bg-elevated, #1e1e28)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderLeft: isActive
                    ? '2px solid var(--accent-blue, #4d9fff)'
                    : '2px solid transparent',
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
