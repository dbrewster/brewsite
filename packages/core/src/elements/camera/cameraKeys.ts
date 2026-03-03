/**
 * Key under which CameraWidget stores the active Three.js camera on scene.userData.
 * Imported by packages that need to retrieve the camera (e.g. @brewsite/charts).
 */
export const SCENE_CAMERA_KEY = '__brewsite_camera' as const;
