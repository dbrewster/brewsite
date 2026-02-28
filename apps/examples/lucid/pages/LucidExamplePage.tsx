import { CameraControlPanel, ScenePlayer } from '@brewsite/core';
import type { JSX } from 'react';
import { createLlmWidgetSetup } from '../widgetSetup';
import { sceneLlmFilter } from '../scenes/scene_llm_filter';

export default function LucidExamplePage(): JSX.Element {
  return (
    <div style={{ minHeight: '100vh' }}>
      <ScenePlayer
        sceneGroup={{ id: 'llm-filter', scenes: [sceneLlmFilter] }}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createLlmWidgetSetup}
        framesPerTick={80}
        pixelsPerScene={1200}
      >
      </ScenePlayer>
    </div>
  );
}
