import {ScenePlayer, useEngineState} from '@brewsite/core';
import type {JSX} from 'react';
import {useEffect, useState} from 'react';
import {createWidgetSetup} from '../widgetSetup';
import {scene01Intro} from '../scenes/scene01_intro';
import {scene02Arrival} from '../scenes/scene02_arrival';

const DebugHud = (): JSX.Element => {
  const state = useEngineState();
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 16,
        padding: '8px 10px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: 12,
        borderRadius: 6,
        pointerEvents: 'none',
      }}
    >
      <div>progress: {state.progress.toFixed(3)}</div>
      <div>sceneId: {state.sceneId || '(none)'}</div>
      <div>sceneIndex: {state.sceneIndex}</div>
      <div>sceneProgress: {state.sceneProgress.toFixed(3)}</div>
    </div>
  );
};

export default function MeetingPage(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ScenePlayer] error', error);
    }
  }, [error]);

  return (
    <div style={{minHeight: '100vh'}}>
      <ScenePlayer
        sceneGroup={{
          id: 'complex',
          scenes: [scene01Intro, scene02Arrival],
        }}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createWidgetSetup}
        framesPerTick={110}
        pixelsPerScene={1500}
        onError={(err) => setError(err)}
        placeholder={(
          <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
            <div>
              <div>Loading scene…</div>
              {error && <div style={{color: '#ffb3b3'}}>Error: {error.message}</div>}
            </div>
          </div>
        )}
      >
        <DebugHud/>
      </ScenePlayer>
    </div>
  );
}
