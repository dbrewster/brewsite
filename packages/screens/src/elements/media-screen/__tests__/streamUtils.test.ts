// Tests for captureCanvasStream and stopCaptureStream.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureCanvasStream, stopCaptureStream } from '../streamUtils';
import { MediaScreenWidget } from '../widget';

afterEach(() => {
  vi.restoreAllMocks();
  MediaScreenWidget._clearRegistryForTest();
});

/** Build a fake MediaStream with a stoppable track. */
function makeFakeStream(): MediaStream {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [track],
  } as unknown as MediaStream;
}

/** Build a fake HTMLCanvasElement whose captureStream returns the given stream. */
function makeFakeCanvas(stream: MediaStream): HTMLCanvasElement {
  return {
    captureStream: vi.fn(() => stream),
  } as unknown as HTMLCanvasElement;
}

describe('captureCanvasStream', () => {
  it('calls canvas.captureStream with the given fps', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    const registerSpy = vi.spyOn(MediaScreenWidget, 'registerStream');

    captureCanvasStream(canvas, 'my-stream', 24);

    expect(canvas.captureStream).toHaveBeenCalledWith(24);
    registerSpy.mockRestore();
  });

  it('registers the stream via MediaScreenWidget.registerStream', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    const registerSpy = vi.spyOn(MediaScreenWidget, 'registerStream');

    captureCanvasStream(canvas, 'my-stream', 30);

    expect(registerSpy).toHaveBeenCalledWith('my-stream', stream);
  });

  it('returns the created stream', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    vi.spyOn(MediaScreenWidget, 'registerStream');

    const result = captureCanvasStream(canvas, 'my-stream', 30);

    expect(result).toBe(stream);
  });

  it('uses default fps of 30 when not specified', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    vi.spyOn(MediaScreenWidget, 'registerStream');

    captureCanvasStream(canvas, 'my-stream');

    expect(canvas.captureStream).toHaveBeenCalledWith(30);
  });
});

describe('stopCaptureStream', () => {
  it('stops all tracks in the stream', () => {
    const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    vi.spyOn(MediaScreenWidget, 'unregisterStream');

    stopCaptureStream('my-stream', stream);

    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('calls MediaScreenWidget.unregisterStream with the streamId', () => {
    const stream = makeFakeStream();
    const unregisterSpy = vi.spyOn(MediaScreenWidget, 'unregisterStream');

    stopCaptureStream('my-stream', stream);

    expect(unregisterSpy).toHaveBeenCalledWith('my-stream');
  });
});
