// Example: reads scene title reactively via useVariable.
// Demonstrates that useVariable is importable directly from '@brewsite/core'.
import type { ReactElement } from 'react';
import { useVariable } from '@brewsite/core';

/**
 * Renders the current scene's title (published by SceneMetaWidget via
 * VariableStore key '__scene_meta__' / 'title').
 */
export const SceneNavIndicator = (): ReactElement | null => {
  const title = useVariable<string>('__scene_meta__', 'title');
  if (!title) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      padding: '4px 12px',
      borderRadius: 4,
      fontSize: 13,
      pointerEvents: 'none',
    }}>
      {title}
    </div>
  );
};
