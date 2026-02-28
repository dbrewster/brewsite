// Public exports for the HUD module. Import HudItemDefinition/HudItemResolved for
// type-level usage; import HudOverlay for rendering in ScenePlayer.
// AnimeJS transition presets are available via the subpath export:
// `@brewsite/core/hud/animejs`.

export type { HudItemDefinition, HudItemResolved } from './types';
export { HudItem } from './HudItem';
export type { HudItemProps } from './HudItem';
export { HudOverlay } from './HudOverlay';
export type { HudOverlayProps } from './HudOverlay';
