// DSL authoring surface — the only things scene authors need to import.
// Infrastructure types (SceneTrack, compileSceneTrack, cache functions) are
// imported directly from their source files by the engine/player layer.

export { Scene, resolveSceneFromDsl } from './sceneDslCompiler';
export type { SceneGroup, SceneDefinition, SceneSnapshotContext } from './sceneTypes';
export type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
export { Hud, HudItem } from './blocks/hudBlocks';
export type { HudProps, HudItemDslProps } from './blocks/hudBlocks';
export { InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap } from './blocks/inputController';
export type {
  InputControllerProps,
  ActionProps,
  PointerMapProps,
  WheelMapProps,
  PinchMapProps,
  KeyMapProps,
} from './blocks/inputController';
export { registerNode } from './registry';
