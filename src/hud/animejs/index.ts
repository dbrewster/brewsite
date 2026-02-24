// Public barrel for the HUD AnimeJS transition sub-module.
// This module is NOT re-exported from src/hud/index.ts — it is an explicit opt-in.

export { useScrollTimeline } from './useScrollTimeline';
export type { TimelineBuilder } from './useScrollTimeline';

export { Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff } from './transitions';
export type { TransitionProps } from './transitions';
