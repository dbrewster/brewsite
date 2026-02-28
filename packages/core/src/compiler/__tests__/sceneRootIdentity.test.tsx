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
  it('uses Scene key as scene identity', () => {
    const { frame } = resolveSceneFromDsl(<Scene key="arch" />, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('arch');
  });

  it('uses Scene id as fallback identity for backward compatibility', () => {
    const { frame } = resolveSceneFromDsl(<Scene id="legacy" />, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('legacy');
  });

  it('warns when Scene has no key or id and falls back to default id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { frame } = resolveSceneFromDsl(<Scene />, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('scene');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
