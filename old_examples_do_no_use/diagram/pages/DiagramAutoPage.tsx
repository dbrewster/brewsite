import { ScenePlayer } from '@brewsite/core';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { createAutoWidgetSetup } from '../autoWidgetSetup';
import { sceneArchAuto } from '../scenes/scene_arch_auto';

export default function DiagramAutoPage(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ScenePlayer] error', error);
    }
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Roboto, sans-serif', fontSize: '.2rem' }}>
      <ScenePlayer
        manifestUrl="/scene-manifest.json"
        widgetSetup={createAutoWidgetSetup}
        framesPerTick={80}
        pixelsPerScene={1200}
        onError={(err) => setError(err)}
        placeholder={(
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div>
              <div>Loading auto-layout diagram…</div>
              {error && <div style={{ color: '#ffb3b3' }}>Error: {error.message}</div>}
            </div>
          </div>
        )}
      >
        {sceneArchAuto}
      </ScenePlayer>
    </div>
  );
}
