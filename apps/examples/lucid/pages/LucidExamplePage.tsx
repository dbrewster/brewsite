import { ScenePlayer } from '@brewsite/core';
import { useDiagramFocusRegion } from '@brewsite/diagram';
import { useMemo } from 'react';
import type { JSX } from 'react';
import { createLlmWidgetSetup } from '../widgetSetup';
import {
  llmFilterGroupHudContent,
  llmFilterSceneHudContent,
  sceneLlmFilter,
  type LlmFilterHudContent,
} from '../scenes/scene_llm_filter';
import './LucidExamplePage.css';

const LlmFilterHud = (): JSX.Element => {
  const focus = useDiagramFocusRegion({ canvasId: 'llm-canvas' });

  const content = useMemo<LlmFilterHudContent>(() => {
    if (focus?.kind === 'group' && focus.groupId) {
      return llmFilterGroupHudContent[focus.groupId] ?? {
        tagline: 'Focused Region',
        title: focus.groupId,
        description: `You are focused on the "${focus.groupId}" region. This view isolates that subsystem so its role and boundaries are easier to inspect in context.`,
      };
    }
    return llmFilterSceneHudContent;
  }, [focus]);

  return (
    <div className="lucid-hud">
      <div className="lucid-hud__content">
        <div className="lucid-hud__tagline">
          {content.tagline}
        </div>
        <div className="lucid-hud__title">
          {content.title}
        </div>
        <div className="lucid-hud__description">
          {content.description}
        </div>
      </div>
    </div>
  );
};

export default function LucidExamplePage(): JSX.Element {
  return (
    <div style={{ minHeight: '100vh' }}>
      <ScenePlayer
        manifestUrl="/scene-manifest.json"
        widgetSetup={createLlmWidgetSetup}
        framesPerTick={80}
        pixelsPerScene={1200}
      >
        {sceneLlmFilter}
      </ScenePlayer>
      {/*<CameraInteractionInfoDialog />*/}
      <LlmFilterHud />
    </div>
  );
}
