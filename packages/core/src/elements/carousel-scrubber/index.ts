export type { CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle, CarouselTraySurfacePattern, ViewHighlightMode, ViewHighlightConfig, ViewHighlight } from './types';
export {
  CarouselScrubber,
  CarouselScrubberWidget,
  carouselScrubberNodeHandler,
  isCarouselScrubberStateLike,
} from './CarouselScrubberWidget';
export {
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  DEFAULT_CAROUSEL_SCRUBBER_STYLE,
} from './compile';
export type { CarouselScrubberProps } from './dsl';
export { Highlight } from './highlightDsl';
export type { HighlightProps } from './highlightDsl';
export { useCarouselHighlight, createCarouselHighlightController } from './useCarouselHighlight';
