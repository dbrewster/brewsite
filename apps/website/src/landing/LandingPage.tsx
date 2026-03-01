import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScenePlayer } from '@brewsite/core';
import { createWidgetSetup } from '../widgetSetup';
import { websiteFlowScenes } from '../scenes/websiteFlow';
import { NavMenu } from './nav/NavMenu';

export default function LandingPage(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) console.error('[WebsiteFlow]', error);
  }, [error]);

  return (
    <ScenePlayer
      id="website-flow-player"
      manifestUrl="/scene-manifest.json"
      widgetSetup={createWidgetSetup}
      quality="balanced"
      pixelsPerScene={1400}
      onError={setError}
      placeholder={
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#8b949e',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
          }}
        >
          Loading BrewSite flow…
        </div>
      }
    >
      {websiteFlowScenes}
      <NavMenu />
    </ScenePlayer>
  );
}
