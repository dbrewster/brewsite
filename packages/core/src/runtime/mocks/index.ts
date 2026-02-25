// Widget-SDK-aware test doubles for the generic runtime layer.
// Import from this barrel in tests that need mock renderables or animation controllers.
export {
  createMockRenderable,
  createMockSceneElementWidget,
  createMockAnimationController,
  type MockRenderable,
  type MockSceneElementWidget,
  type MockAnimationController,
} from './widgetMocks';
