/**
 * Camera element DSL component.
 */

import type { SceneCamera } from './types';

export type CameraProps = Partial<SceneCamera>;

export const Camera = (_props: CameraProps) => null;

Camera.displayName = 'Camera';
