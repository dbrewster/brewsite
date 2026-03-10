// Barrel export for the layout module.
export type { NVSRect, NVSPosition, INVSBounded } from './types';
export { nvsToWorldAnalytic, worldToNvsAnalytic, nvsToWorldWithCamera, worldToNvsWithCamera, computeWorldDimensions, computeWorldDimensionsFromCamera } from './nvsWorldBridge';
export { validateNVSScalar, validateNVSRect, validateNVSPosition } from './nvsValidation';
export { createNVSCoordService } from './nvsCoordService';
