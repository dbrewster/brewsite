// Pure carousel index computation.

/** Input describing a carousel step operation. */
export type CarouselStepInput = {
  currentIndex: number;
  direction: 1 | -1;
  step: number;
  childCount: number;
  loop: boolean;
};

/**
 * Computes the new carousel index after stepping.
 * Returns null if the index didn't change (clamped at boundary, empty carousel).
 */
export function computeCarouselStep(input: CarouselStepInput): number | null {
  if (input.childCount === 0) return null;

  const rawNext = input.currentIndex + input.direction * input.step;
  let newIndex: number;

  if (input.loop) {
    newIndex = ((rawNext % input.childCount) + input.childCount) % input.childCount;
  } else {
    newIndex = Math.max(0, Math.min(input.childCount - 1, rawNext));
  }

  if (newIndex === input.currentIndex) return null;
  return newIndex;
}
