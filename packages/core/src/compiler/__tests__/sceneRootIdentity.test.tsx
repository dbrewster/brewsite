import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl } from '../sceneDslCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
});

describe('scene root identity', () => {
  it('uses Scene id as scene identity', () => {
    const { frame } = resolveSceneFromDsl(<Scene id="arch" />, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('arch');
  });

  it('keeps Scene key as fallback identity for backward compatibility', () => {
    const legacyScene = React.createElement(Scene as unknown as (props: Record<string, unknown>) => null, {
      key: 'legacy',
    });
    const { frame } = resolveSceneFromDsl(legacyScene, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('legacy');
  });

  it('warns when Scene has no id and falls back to default id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const noIdScene = React.createElement(Scene as unknown as (props: Record<string, unknown>) => null, {});
    const { frame } = resolveSceneFromDsl(noIdScene, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('scene');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
