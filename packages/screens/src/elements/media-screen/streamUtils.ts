// Utility functions for creating and stopping capture streams.
// No React. No Three.js.

import { MediaScreenWidget } from './widget';

/**
 * Captures a same-origin canvas as a live MediaStream and registers it
 * with MediaScreenWidget. No browser permission dialog.
 *
 * @param canvas    Source canvas. Must be same-origin and untainted.
 * @param streamId  Key used in <MediaScreen streamId="...">.
 * @param frameRate Cap the capture FPS (default: 30).
 * @returns The created MediaStream.
 */
export function captureCanvasStream(
  canvas: HTMLCanvasElement,
  streamId: string,
  frameRate = 30,
): MediaStream {
  const stream = canvas.captureStream(frameRate);
  MediaScreenWidget.registerStream(streamId, stream);
  return stream;
}

/**
 * Stops all tracks in a stream and unregisters it from MediaScreenWidget.
 * Call on cleanup (component unmount, scene teardown).
 */
export function stopCaptureStream(streamId: string, stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
  MediaScreenWidget.unregisterStream(streamId);
}
