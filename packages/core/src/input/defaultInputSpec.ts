// defaultInputSpec.ts — Pure factory for the standard input binding set.

import type { SceneInputControllerSpec, InputActionSpec } from './types';

/**
 * Options for createDefaultInputSpec.
 */
export type DefaultInputSpecOptions = {
  /** Widget ID of the primary camera. Default: 'camera'. */
  cameraId?: string;
  /** Widget ID of the primary action-input canvas. Default: undefined. */
  canvasId?: string;
};

/**
 * Default input controller widget ID.
 * Must match INPUT_CONTROLLER_WIDGET_ID from compiler/blocks/inputController.tsx.
 */
export const DEFAULT_INPUT_CONTROLLER_ID = 'input-controller';

/**
 * Sentinel layoutId used for carousel actions in the default spec.
 * At runtime, InputCoordinator resolves this to the current scene's
 * `primaryCarouselId`. When no `primaryCarouselId` is set, the action
 * is a silent no-op.
 *
 * This sentinel approach means the default spec is always identical
 * regardless of whether a carousel exists — the compiler does not need
 * to know `primaryCarouselId` at injection time.
 */
export const PRIMARY_CAROUSEL_SENTINEL = '__primary_carousel__';

/**
 * Returns the standard SceneInputControllerSpec with all default bindings.
 *
 * This is the binding set injected by the compiler when no <InputController>
 * is declared in a scene. Scene authors can override individual actions by
 * declaring their own <InputController> with a subset of these actions.
 *
 * The spec always includes carousel actions using the sentinel layoutId.
 * At runtime, InputCoordinator resolves the sentinel to `primaryCarouselId`.
 * When no carousel exists, the carousel actions are silent no-ops.
 *
 * @param options.cameraId — Widget ID of the primary camera. Default: 'camera'.
 * @param options.canvasId — Widget ID of the primary action-input canvas. Default: undefined.
 */
export function createDefaultInputSpec(options?: DefaultInputSpecOptions): SceneInputControllerSpec {
  const cameraId = options?.cameraId ?? 'camera';

  const actions: InputActionSpec[] = [
    // ── Scene navigation (keyboard) ──
    // Scroll Y is handled by the unclaimed-wheel -> inertia path (ALWAYS).
    // Arrow keys provide discrete scene stepping.
    {
      id: 'default-scene-next',
      type: 'scene.next',
      maps: [{ kind: 'key', key: 'ArrowDown' }],
    },
    {
      id: 'default-scene-prev',
      type: 'scene.prev',
      maps: [{ kind: 'key', key: 'ArrowUp' }],
    },

    // ── Camera orbit (Cmd/Ctrl+scroll + 2-finger touch) ──
    // Desktop: Cmd+scroll (Meta modifier). Touch: 2-finger drag.
    // Left drag is intentionally FREE — no default consumes it.
    // This keeps overlays, text selection, and future interactions unblocked.
    {
      id: 'default-camera-orbit',
      type: 'camera.orbit',
      cameraId,
      maps: [
        { kind: 'wheel', modifiers: ['meta'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', touches: 2, axis: 'xy' },
      ],
    },

    // ── Camera zoom (pinch only) ──
    // Pinch (touch or trackpad) for zoom. No plain wheel — scroll is sacred.
    {
      id: 'default-camera-zoom',
      type: 'camera.zoom',
      cameraId,
      maps: [
        { kind: 'pinch', direction: 'both' },
      ],
    },

    // ── Camera pan (Shift+scroll + middle-drag + 3-finger touch) ──
    // Desktop: Shift+scroll. Touch: 3-finger drag.
    {
      id: 'default-camera-pan',
      type: 'camera.pan',
      cameraId,
      maps: [
        { kind: 'wheel', modifiers: ['shift'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
        { kind: 'pointer', event: 'drag', touches: 3, axis: 'xy' },
      ],
    },

    // ── Camera reset ('r' key) ──
    {
      id: 'default-camera-reset',
      type: 'camera.reset',
      cameraId,
      maps: [{ kind: 'key', key: 'r' }],
    },

    // ── Carousel navigation (keyboard) ──
    // Scroll X is handled by the unclaimed-wheel -> X-inertia path (ALWAYS).
    // Arrow keys provide discrete stepping.
    {
      id: 'default-carousel-next',
      type: 'carousel.next',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [
        { kind: 'key', key: 'ArrowRight' },
      ],
    },
    {
      id: 'default-carousel-prev',
      type: 'carousel.prev',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [
        { kind: 'key', key: 'ArrowLeft' },
      ],
    },
  ];

  return {
    id: DEFAULT_INPUT_CONTROLLER_ID,
    scope: 'canvas',
    actions,
  };
}
