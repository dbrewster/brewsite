import { describe, it, expect } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl } from '../sceneDslCompiler';
import { Hud, HudItem } from '../blocks/hudBlocks';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

// Ensure blocks are registered before first use
import '../blocks/hudBlocks';

const context = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
};

const registry = new WidgetRegistry();

describe('hudBlocks DSL compilation', () => {
  it('compiles a single HudItem into SceneFrame.hudItems', () => {
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="banner">
            <span>Hello</span>
          </HudItem>
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toHaveLength(1);
    expect(frame.hudItems?.[0]?.id).toBe('banner');
  });

  it('compiles multiple HudItems', () => {
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="a" />
          <HudItem id="b" />
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toHaveLength(2);
    expect(frame.hudItems?.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('preserves enabled, className, and style props', () => {
    const style = { top: '10px' };
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="x" enabled={false} className="my-cls" style={style} />
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const item = frame.hudItems?.[0];
    expect(item?.enabled).toBe(false);
    expect(item?.className).toBe('my-cls');
    expect(item?.style).toEqual({ top: '10px' });
  });

  it('produces no hudItems when Hud has no children', () => {
    const tree = (
      <Scene id="s1">
        <Hud />
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems ?? []).toHaveLength(0);
  });

  it('produces no hudItems when scene has no Hud block', () => {
    const tree = <Scene id="s1" />;
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toBeUndefined();
  });
});
