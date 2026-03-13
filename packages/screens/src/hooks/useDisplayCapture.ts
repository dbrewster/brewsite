// React hook for getDisplayMedia() lifecycle with automatic MediaScreenWidget registration.

import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaScreenWidget } from '../elements/media-screen/widget';

export interface UseDisplayCaptureOptions {
  /** 'browser' = current tab, 'window' = app window, 'monitor' = full screen. Default: 'browser'. */
  displaySurface?: 'browser' | 'window' | 'monitor';
  /** Frame rate cap. Default: 30. */
  frameRate?: number;
  /** Chrome 109+: pre-select current tab in picker. Default: true. */
  preferCurrentTab?: boolean;
}

export interface UseDisplayCaptureResult {
  /** Call from a click handler — browser requires a user gesture. */
  startCapture: () => Promise<void>;
  /** Stop capture and release the stream. Safe to call when not capturing. */
  stopCapture: () => void;
  isCapturing: boolean;
  error: Error | null;
}

export function useDisplayCapture(
  streamId: string,
  options?: UseDisplayCaptureOptions,
): UseDisplayCaptureResult {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopCapture = useCallback((): void => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    MediaScreenWidget.unregisterStream(streamId);
    setIsCapturing(false);
  }, [streamId]);

  const startCapture = useCallback(async (): Promise<void> => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError(new Error('getDisplayMedia is not supported in this environment.'));
      return;
    }
    stopCapture();
    try {
      const opts = optionsRef.current;
      const constraints: DisplayMediaStreamOptions = {
        video: {
          displaySurface: opts?.displaySurface ?? 'browser',
          frameRate: { ideal: opts?.frameRate ?? 30 },
        } as MediaTrackConstraints,
        audio: false,
      };
      if (opts?.preferCurrentTab !== false)
        (constraints as unknown as Record<string, unknown>)['preferCurrentTab'] = true;

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;
      MediaScreenWidget.registerStream(streamId, stream);
      setIsCapturing(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          streamRef.current = null;
          MediaScreenWidget.unregisterStream(streamId);
          setIsCapturing(false);
        }, { once: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsCapturing(false);
    }
  }, [streamId, stopCapture]);

  useEffect(() => {
    return (): void => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        MediaScreenWidget.unregisterStream(streamId);
      }
    };
  }, [streamId]);

  return { startCapture, stopCapture, isCapturing, error };
}
