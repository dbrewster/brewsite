// @vitest-environment node
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScenePlayer } from '../ScenePlayer';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { Scene } from '../../compiler/sceneDslCompiler';

const manifest = {
  version: 2,
  models: [],
  animations: [],
};

const manifestUrl = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`;

describe('ScenePlayer (server)', () => {
  it('renders placeholder when window is undefined', () => {
    const html = renderToStaticMarkup(
      <ScenePlayer
        manifestUrl={manifestUrl}
        widgetSetup={() => new WidgetRegistry()}
        placeholder={<div>Loading</div>}
      >
        <Scene key="s1" />
      </ScenePlayer>,
    );
    expect(html).toContain('Loading');
  });
});
