// packages/slides/src/player/PresenterView.tsx
// Same-tab collapsible presenter panel showing speaker notes and slide number.
// No multi-window support — that is v1.1+.

import React, { useState, type CSSProperties, type ReactElement } from 'react';
import { useCurrentScene } from '@brewsite/core';
import { useSlideNotes } from './useSlideNotes';

/** Props for PresenterView. */
export type PresenterViewProps = {
  /** Total slide count for the current deck. */
  total: number;
  /** Initial collapsed state. Default: false. */
  defaultCollapsed?: boolean;
};

/**
 * Collapsible presenter panel rendered as an overlay at the bottom of the engine container.
 * Shows the current slide number and speaker notes authored via <Slide notes="..."/>.
 *
 * Must be used inside an SceneEngine subtree.
 */
export const PresenterView = ({ total, defaultCollapsed = false }: PresenterViewProps): ReactElement => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // useCurrentScene returns { id: string; index: number }
  const { id: slideKey, index } = useCurrentScene();
  const notes = useSlideNotes(slideKey);

  const panelStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.85)',
    color: '#ffffff',
    fontFamily: 'var(--brewsite-font-family, system-ui, sans-serif)',
    fontSize: '0.875rem',
    zIndex: 50,
    maxHeight: collapsed ? '2rem' : '12rem',
    overflow: 'hidden',
    transition: 'max-height 0.2s ease',
  };

  return (
    <div style={panelStyle} data-testid="presenter-view">
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand presenter notes' : 'Collapse presenter notes'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '0.375rem 0.75rem',
          fontSize: '0.75rem',
          fontFamily: 'inherit',
          textAlign: 'left',
        } as CSSProperties}
      >
        <span aria-hidden>{collapsed ? '▲' : '▼'}</span>
        <span>Presenter · Slide {index + 1} / {total}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem 0.75rem', lineHeight: 1.5, overflowY: 'auto', maxHeight: '9rem' }}>
          {notes
            ? <p style={{ margin: 0 }}>{notes}</p>
            : <p style={{ margin: 0, opacity: 0.5 }}>(No speaker notes)</p>
          }
        </div>
      )}
    </div>
  );
};
PresenterView.displayName = 'PresenterView';
