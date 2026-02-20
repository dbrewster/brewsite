import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';
import { simpleSceneGroup } from '../scenes/sceneGroup';
import type { AssetManifest } from '@brewsite/core';
import type { JSX } from 'react';

export default function SimplePage(): JSX.Element {
  return (
    <div style={{ minHeight: '200vh' }}>
      <ScenePlayer
        sceneGroup={simpleSceneGroup}
        manifestUrl="/scene-manifest.json"
        widgetSetup={(manifest: AssetManifest | null, options) =>
          createDefaultWidgetRegistry(manifest, options)}
      />
    </div>
  );
}
