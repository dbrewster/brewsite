import { ScenePlayer } from '@brewsite/core';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { createWidgetSetup } from '../widgetSetup';
import { scene01Diagram } from '../scenes/scene01_diagram';

export default function DiagramPage(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ScenePlayer] error', error);
    }
  }, [error]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <ScenePlayer
        sceneGroup={{
          id: 'diagram',
          scenes: [scene01Diagram],
        }}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createWidgetSetup}
        framesPerTick={80}
        pixelsPerScene={1200}
        onError={(err) => setError(err)}
        placeholder={(
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div>
              <div>Loading scene…</div>
              {error && <div style={{ color: '#ffb3b3' }}>Error: {error.message}</div>}
            </div>
          </div>
        )}
      />
    </div>
  );
}
