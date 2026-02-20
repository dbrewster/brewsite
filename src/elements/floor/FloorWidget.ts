// FloorWidget — ISceneElement + IRenderable (simple prop-only DSL, no children).
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneFloor } from './types';
import { DEFAULT_FLOOR, floorTransitionSpec } from './compile';
import { Floor } from './dsl';
import { applyFloor } from './render';

export class FloorWidget implements ISceneElement<SceneFloor>, IRenderable<SceneFloor> {
  readonly widgetId = 'floor';
  readonly defaultState: SceneFloor = DEFAULT_FLOOR;
  readonly transitionSpec = floorTransitionSpec;
  readonly DslComponent = Floor;

  private threeScene: THREE.Scene | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
  }

  apply(state: SceneFloor, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    applyFloor(state, { scene: this.threeScene });
  }

  dispose(): void {
    this.threeScene = null;
  }
}
