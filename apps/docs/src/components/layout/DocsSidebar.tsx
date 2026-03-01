import { JSX, useCallback } from 'react';
import { useSceneEngineState } from '@brewsite/core';
import { docsNav, SCENE_SCROLL_OFFSETS } from '../../nav/docs-nav';
import type { NavSection } from '../../nav/types';

/**
 * DocsSidebar — sticky left navigation for the continuous-scroll docs experience.
 *
 * Intentionally lives OUTSIDE the ScenePlayer tree. It reads the active scene
 * from the global engine registry via useSceneEngineState('docs'), which requires
 * no EngineProvider ancestor.
 *
 * Click-to-scroll uses precomputed SCENE_SCROLL_OFFSETS (derived from each scene's
 * scrollUnits budget). With pixelsPerScene={1} on ScenePlayer, these offsets are
 * exact pixel values for window.scrollTo.
 */
export function DocsSidebar(): JSX.Element {
  const engineState = useSceneEngineState('docs');
  const activeSceneId = engineState?.sceneId ?? '';

  const scrollToScene = useCallback((sceneId: string) => {
    const offset = SCENE_SCROLL_OFFSETS[sceneId];
    if (offset !== undefined) {
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, []);

  return (
    <aside className="docs-sidebar">
      {/* Brand / logo */}
      <div className="docs-sidebar__brand">
        <span className="doc-header__brand">BrewSite</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 4, fontWeight: 400 }}>
          Docs
        </span>
      </div>

      {/* Navigation sections */}
      {docsNav.map((section: NavSection) => (
        <div key={section.title} className="nav-section">
          <div className="nav-section__title">{section.title}</div>
          {section.items.map((item) => (
            <button
              key={item.sceneId}
              type="button"
              className={`nav-item nav-item--button${
                activeSceneId === item.sceneId ? ' nav-item--active' : ''
              }`}
              onClick={() => scrollToScene(item.sceneId ?? '')}
              aria-current={activeSceneId === item.sceneId ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
