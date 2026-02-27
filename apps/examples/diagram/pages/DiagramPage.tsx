import { ScenePlayer } from '@brewsite/core';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { createWidgetSetup } from '../widgetSetup';
import { sceneArchEcsDetail } from '../scenes/scene_arch_ecs_detail';
import { sceneArchOverview } from '../scenes/scene_arch_overview';

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
          scenes: [sceneArchOverview, sceneArchEcsDetail],
        }}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createWidgetSetup}
        framesPerTick={80}
        pixelsPerScene={1200}
        // inputMap={{
        //   mode: 'direct',
        //   wheel: false,
        //   drag: false,
        //   swipe: false,
        //   click: [
        //     { button: 'left', action: 'nextScene' },
        //     { button: 'right', action: 'prevScene' },
        //   ],
        //   keys: {
        //     nextScene: { key: 'ArrowRight' },
        //     prevScene: { key: 'ArrowLeft' },
        //   },
        // }}
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
