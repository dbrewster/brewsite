// DiagramWidget — implements ISceneElement<DiagramState> + IRenderable.

import type * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { Diagram } from './dsl';
import { functionalDiagramTransitionSpec } from './compile';
import { DiagramRenderer } from './render';
import type { DiagramState } from './types';

export class DiagramWidget implements ISceneElement<DiagramState>, IRenderable<DiagramState> {
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;

  private renderer = new DiagramRenderer();
  private scene: THREE.Scene | null = null;

  constructor(widgetId: string, defaultState: DiagramState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
  }

  apply(state: DiagramState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;
    this.renderer.update(state, this.scene);
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
  }
}
