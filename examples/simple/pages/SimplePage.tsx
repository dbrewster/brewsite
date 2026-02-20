import { ScenePlayer } from '@brewsite/core';
import { simpleSceneGroup } from '../scenes/sceneGroup';
import type { JSX } from 'react';
import { createWidgetSetup } from '../widgetSetup';

export default function SimplePage(): JSX.Element {
  return (
    <div style={{ minHeight: '200vh' }}>
      <ScenePlayer
        sceneGroup={simpleSceneGroup}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createWidgetSetup}
      />
    </div>
  );
}
