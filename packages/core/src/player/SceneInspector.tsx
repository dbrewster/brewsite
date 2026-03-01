// Debug overlay — renders only when debug={true} is passed to ScenePlayer.
// Tree-shaken in production builds when the prop is omitted or statically false.
import type { CSSProperties, ReactElement } from 'react';
import { useEngineState } from './EngineStateContext';
import { useSceneEngineContext } from './EngineContext';

export type SceneInspectorProps = {
  /** Ordered list of scene IDs. */
  sceneIds: string[];
};

const PANEL: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  background: 'rgba(0,0,0,0.88)',
  color: '#e2e8f0',
  fontFamily: 'monospace',
  fontSize: 11,
  lineHeight: '1.5',
  padding: '8px 12px',
  borderRadius: 6,
  zIndex: 9999,
  minWidth: 240,
  border: '1px solid rgba(255,255,255,0.1)',
  pointerEvents: 'auto',
};

const SCENE_BTN_BASE: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '2px 4px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'monospace',
  borderRadius: 3,
  color: '#94a3b8',
};

const SCENE_BTN_ACTIVE: CSSProperties = {
  ...SCENE_BTN_BASE,
  background: 'rgba(99,102,241,0.3)',
  color: '#a5b4fc',
};

export const SceneInspector = ({ sceneIds }: SceneInspectorProps): ReactElement => {
  const state = useEngineState();
  const engine = useSceneEngineContext();
  const sceneCount = Math.max(1, sceneIds.length);

  const jumpToScene = (index: number): void => {
    engine.scrollToProgress(index / Math.max(1, sceneCount - 1));
  };

  return (
    <div style={PANEL}>
      <div style={{ marginBottom: 6, fontWeight: 'bold', color: '#64748b', userSelect: 'none' }}>
        ⚙ Scene Inspector
      </div>

      <div style={{ marginBottom: 8 }}>
        {sceneIds.map((sceneKey, i) => {
          const isActive = sceneKey === state.sceneId;
          return (
            <button
              key={sceneKey}
              onClick={() => jumpToScene(i)}
              style={isActive ? SCENE_BTN_ACTIVE : SCENE_BTN_BASE}
            >
              {isActive ? '▶ ' : '  '}
              {sceneKey}
            </button>
          );
        })}
      </div>

      <div style={{ color: '#64748b', fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
        <div>scene   {state.sceneIndex + 1} / {sceneCount}  [{state.sceneId}]</div>
        <div>progress  {state.progress.toFixed(4)}</div>
        <div>sceneProgress  {state.sceneProgress.toFixed(4)}</div>
      </div>
    </div>
  );
};
