export * from './player';
export * from './theme';
export * from './compiler';
export * from './timeline';
export * from './widget';
export * from './elements';
export * from './layout';
export * from './math';
export * from './runtime';
export * from './input';
export type { FunctionalTransitionSpec, ElementTransitionSpec } from './compiler/transitions/transitionTypes';
export { blendNumber, blendOpacity, blendVec3, blendColor, transitionT, blendAxisRotation, blendAxisTranslation, resolveEnabledByOpacity } from './compiler/transitions/transitionTypes';
export { ensureText, disposeText } from './text/TextRenderer';
export type { TextWithLayout } from './text/types';

// ─── New in pre-release API hardening ─────────────────────────────────────────
export type { AssetManifest } from './widget/types';
export { hasCustomDslHandler, CUSTOM_NODE_HANDLER } from './widget/WidgetRegistry';
export type { IHasCustomDslHandler } from './widget/WidgetRegistry';
export type { ISceneLifecycle } from './widget/types';
export { isSceneLifecycle } from './widget/WidgetRegistry';

// ─── Scene track helpers ────────────────────────────────────────────────────────
export { getSceneProgressFromTrack } from './compiler/sceneTrackHelpers';

// ─── Dev utilities ─────────────────────────────────────────────────────────────
export { clearCache as clearSceneTrackCache } from './compiler/sceneTrackCache';

// ─── S2 — Public API additions (eliminates @brewsite/model deep sub-path imports) ──
export type { AnimationTrack } from './runtime/types';
export type { Resolvable } from './compiler/sceneTypes';
export { getNodeHandler } from './compiler/registry';
export type { CompileWarning } from './compiler/sceneTrackTypes';

