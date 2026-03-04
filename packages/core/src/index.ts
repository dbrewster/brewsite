export * from './player';
export * from './theme';
export * from './compiler';
export * from './timeline';
export * from './widget';
export * from './elements';
export * from './math';
export * from './runtime';
export * from './input';
export type { FunctionalTransitionSpec, ElementTransitionSpec } from './compiler/transitions/transitionTypes';
export { blendNumber, blendOpacity, blendVec3, blendColor, transitionT } from './compiler/transitions/transitionTypes';
export { registerNode } from './compiler/registry';
export { SCENE_CAMERA_KEY } from './elements/camera';
export { ensureText } from './text/TextRenderer';
export type { TextWithLayout } from './text/types';

// ─── New in pre-release API hardening ─────────────────────────────────────────
export type { AssetManifest } from './widget/types';
export { hasCustomDslHandler, CUSTOM_NODE_HANDLER } from './widget/WidgetRegistry';
export type { IHasCustomDslHandler } from './widget/WidgetRegistry';
export type { ISceneLifecycle } from './widget/types';
export { isSceneLifecycle } from './widget/WidgetRegistry';
