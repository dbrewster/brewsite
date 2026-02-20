import type { SceneGroup } from '@brewsite/core';
import { createSceneTimeline } from '@brewsite/core';
import { scene01Move } from './scene01_move';
import { scene02Move } from './scene02_move';

const scenes = [scene01Move, scene02Move];

export const simpleSceneGroup: SceneGroup = {
  id: 'simple',
  scenes,
  timeline: createSceneTimeline(scenes),
};
