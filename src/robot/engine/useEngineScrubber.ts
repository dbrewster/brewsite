import { useCallback, useRef } from 'react';
import type { PointerEventHandler, RefObject } from 'react';
import { clamp01 } from '../robotTimelineMath';

const SCROLL_TRACK_LEFT_PAD_PX = 12;
const SCROLL_TRACK_TOTAL_PAD_PX = 24;

export type UseEngineScrubberOptions = {
  progress: number;
  scrollToProgress: (next: number) => void;
  barRef: RefObject<HTMLElement | null>;
};

export type UseEngineScrubberResult = {
  handlePointerDown: PointerEventHandler<HTMLDivElement>;
  handlePointerMove: PointerEventHandler<HTMLDivElement>;
  handlePointerUp: PointerEventHandler<HTMLDivElement>;
  handlePointerLeave: PointerEventHandler<HTMLDivElement>;
  /** Jump to a named stop. scrollToProgress is the single source of truth. */
  onStopClick: (stopIndex: number, stopsCount: number) => void;
};

/**
 * Bidirectional scrubber drag hook.
 *
 * Extracted from SceneProgressScroller. Receives scrollToProgress from
 * useEngineScroll and calls it on drag/click. Returns pointer event handlers
 * to attach to the scrubber bar DOM element.
 *
 * Invariant: scrollToProgress() is the single source of truth.
 * Scrubber display reads scroll state; it has no independent internal state.
 */
export const useEngineScrubber = ({
  scrollToProgress,
  barRef,
}: UseEngineScrubberOptions): UseEngineScrubberResult => {
  const draggingRef = useRef(false);

  const getProgressFromClientX = useCallback(
    (clientX: number): number => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const trackLeft = rect.left + SCROLL_TRACK_LEFT_PAD_PX;
      const trackWidth = Math.max(1, rect.width - SCROLL_TRACK_TOTAL_PAD_PX);
      return clamp01((clientX - trackLeft) / trackWidth);
    },
    [barRef],
  );

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      scrollToProgress(getProgressFromClientX(event.clientX));
    },
    [scrollToProgress, getProgressFromClientX],
  );

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      scrollToProgress(getProgressFromClientX(event.clientX));
    },
    [scrollToProgress, getProgressFromClientX],
  );

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = useCallback((event) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handlePointerLeave: PointerEventHandler<HTMLDivElement> = useCallback((event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onStopClick = useCallback(
    (stopIndex: number, stopsCount: number) => {
      scrollToProgress(stopIndex / Math.max(1, stopsCount - 1));
    },
    [scrollToProgress],
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    onStopClick,
  };
};
