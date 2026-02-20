// @vitest-environment node
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScenePlayer } from '../ScenePlayer';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { createSceneTimeline } from '../../timeline';
import type { SceneGroup } from '../../compiler/sceneTypes';

const makeSceneGroup = (): SceneGroup => {
  const scenes = [
    { id: 's1', index: 0, getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: {} }) },
  ];
  return { id: 'group', scenes, timeline: createSceneTimeline(scenes) };
};

const manifest = {
  version: 2,
  models: [],
  containedModels: [],
  animations: [],
};

const manifestUrl = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`;

describe('ScenePlayer (server)', () => {
  it('renders placeholder when window is undefined', () => {
    const html = renderToStaticMarkup(
      <ScenePlayer
        sceneGroup={makeSceneGroup()}
        manifestUrl={manifestUrl}
        widgetSetup={() => new WidgetRegistry()}
        placeholder={<div>Loading</div>}
      />,
    );
    expect(html).toContain('Loading');
  });
});
