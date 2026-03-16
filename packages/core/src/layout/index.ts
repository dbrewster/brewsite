// Barrel export for the layout module.
export type { NVSRect, NVSPosition, INVSBounded } from './types';
export { nvsToWorldAnalytic, worldToNvsAnalytic, nvsToWorldWithCamera, worldToNvsWithCamera, computeWorldDimensions, computeWorldDimensionsFromCamera } from './nvsWorldBridge';
export { validateNVSScalar, validateNVSRect, validateNVSPosition } from './nvsValidation';
export type { NVSCameraParams } from './nvsCoordService';
export { createNVSCoordService, resolveNVSParamsFromCameraState } from './nvsCoordService';

// Region types
export type {
  RegionBounds,
  RegionPadding,
  NormalizedPadding,
  RegionContract,
  ResolvedRegion,
  ViewLayoutKind,
  StackLayoutConfig,
  CarouselLayoutConfig,
  ViewLayoutConfig,
  ViewLayoutResult,
} from './regionTypes';

// Region helpers
export {
  normalizePadding,
  applyPaddingToRect,
  resolveRegion,
  composeBoundsIntoParent,
  unionBounds,
} from './regionNormalize';

// Layout resolution
export { resolveLayout, resolveStackLayout, resolveCarouselLayout, resolveLoopCarouselLayout } from './regionLayout';
