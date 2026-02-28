// Scroll-driven transition wrappers for use as children of DSL <HudItem> elements.
// Must be rendered inside <ScenePlayer> (EngineStateContext must be provided).

import { useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import anime from 'animejs';
import { useScrollTimeline } from './useScrollTimeline';
import { useHudPhase } from '../HudPhaseContext';

// ─── Shared prop type ─────────────────────────────────────────────────────────

export type TransitionProps = {
  children?: ReactNode;
  /**
   * Total scrub duration in ms. sceneProgress 0→1 maps to 0→duration.
   * Preset defaults:
   * - Fade: 600
   * - MidFade: 1000
   * - SlideUp: 600
   * - SlideDown: 600
   * - ScrollOn: 1000
   * - ScrollOff: 1000
   */
  duration?: number;
  /**
   * Delay in ms before the animation begins within the timeline.
   * Use to stagger multiple items: first={delay:0}, second={delay:100}, third={delay:200}.
   */
  delay?: number;
  /** AnimeJS easing string. Defaults vary per preset. */
  easing?: string;
};

// ─── Fade ────────────────────────────────────────────────────────────────────

/**
 * Fades from opacity 0 → 1 across the full sceneProgress range.
 * This is the only phase-aware preset: when rendered in an exit-phase HudItem,
 * it auto-reverses and fades 1 → 0.
 * Default duration: 600ms.
 *
 * @example
 * <HudItem id="label"><Fade><span>Caption</span></Fade></HudItem>
 */
export const Fade = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeInOutSine',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useHudPhase() ?? 'enter';
  const half = duration * 0.5;

  useScrollTimeline(
    ref,
    (target) =>
      phase === 'exit'
        ? anime.timeline({ autoplay: false })
          .add({ targets: target, opacity: [1, 0], duration: half, easing, delay })
          .add({ targets: target, opacity: 0, duration: half })
        : anime.timeline({ autoplay: false })
          .add({ targets: target, opacity: 0, duration: half, delay })
          .add({ targets: target, opacity: [0, 1], duration: half, easing }),
    duration + delay,
    [duration, delay, easing, phase] as const,
  );

  return <div ref={ref} style={{ opacity: phase === 'exit' ? 1 : 0 }}>{children}</div>;
};

// ─── MidFade ─────────────────────────────────────────────────────────────────

/**
 * Fades in during the first half of sceneProgress, holds at full opacity for the second half.
 * Replicates the mid-fade behaviour from the legacy annotation system.
 * Enter-only preset: does not auto-reverse during exit phase.
 * Default duration: 1000ms.
 *
 * @example
 * <HudItem id="title"><MidFade><h2>Heading</h2></MidFade></HudItem>
 */
export const MidFade = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active = duration - delay;
  const fadeIn = active * 0.5;
  const hold = active * 0.5;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], duration: fadeIn, easing, delay })
        .add({ targets: target, opacity: 1, duration: hold }),
    duration,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── SlideUp ─────────────────────────────────────────────────────────────────

/**
 * Slides up from below and fades in across the full sceneProgress range.
 * Use `delay` to stagger multiple items in a scene.
 * Enter-only preset: does not auto-reverse during exit phase.
 * Default duration: 600ms.
 *
 * @example
 * <HudItem id="line-1"><SlideUp>First</SlideUp></HudItem>
 * <HudItem id="line-2"><SlideUp delay={100}>Second</SlideUp></HudItem>
 * <HudItem id="line-3"><SlideUp delay={200}>Third</SlideUp></HudItem>
 */
export const SlideUp = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['24px', '0px'], duration, easing, delay }),
    duration + delay,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── SlideDown ───────────────────────────────────────────────────────────────

/**
 * Slides down from above and fades in across the full sceneProgress range.
 * Enter-only preset: does not auto-reverse during exit phase.
 * Default duration: 600ms.
 *
 * @example
 * <HudItem id="nav"><SlideDown><nav>Menu</nav></SlideDown></HudItem>
 */
export const SlideDown = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['-24px', '0px'], duration, easing, delay }),
    duration + delay,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── ScrollOn ────────────────────────────────────────────────────────────────

/**
 * Enters during the first 35% of sceneProgress, holds for the remainder.
 * Good for content that should be fully visible early and stay stable.
 * Enter-only preset: does not auto-reverse during exit phase.
 * Default duration: 1000ms.
 *
 * @example
 * <HudItem id="stat"><ScrollOn><strong>247</strong> customers</ScrollOn></HudItem>
 */
export const ScrollOn = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeOutExpo',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active = duration - delay;
  const enterDuration = active * 0.35;
  const holdDuration = active * 0.65;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['12px', '0px'], duration: enterDuration, easing, delay })
        .add({ targets: target, opacity: 1, duration: holdDuration }),
    duration,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── ScrollOff ───────────────────────────────────────────────────────────────

/**
 * Holds visible until the final 35% of sceneProgress, then exits upward.
 * Good for content that should remain visible while the user is scrolling away.
 * Exit-phase preset: starts visible and animates out by construction.
 * Does not check useHudPhase() — pair with an enter preset (ScrollOn, SlideUp, etc.)
 * on the corresponding enter-phase HudItem.
 * Default duration: 1000ms.
 *
 * @example
 * <HudItem id="cta"><ScrollOff><button>Learn more</button></ScrollOff></HudItem>
 */
export const ScrollOff = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeInExpo',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active = duration - delay;
  const holdDuration = active * 0.65;
  const exitDuration = active * 0.35;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, delay, opacity: 1, duration: holdDuration })
        .add({ targets: target, opacity: [1, 0], translateY: ['0px', '-12px'], duration: exitDuration, easing }),
    duration,
    [duration, delay, easing] as const,
  );

  // ScrollOff starts visible — no opacity:0 needed
  return <div ref={ref}>{children}</div>;
};
