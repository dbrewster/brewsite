import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisplayCapture } from '../useDisplayCapture';
import { MediaScreenWidget } from '../../elements/media-screen/widget';

// ── Fake stream ───────────────────────────────────────────────────────────────
type EndedCallback = () => void;

function createFakeStream(): {
  stream: MediaStream;
  mockTrack: { stop: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> };
  triggerEnded: () => void;
} {
  let endedCallback: EndedCallback | null = null;
  const mockTrack = {
    stop: vi.fn(),
    addEventListener: vi.fn((evt: string, cb: EndedCallback, _opts?: unknown) => {
      if (evt === 'ended') endedCallback = cb;
    }),
  };
  const stream = {
    getTracks: () => [mockTrack],
    getVideoTracks: () => [mockTrack],
  } as unknown as MediaStream;
  return {
    stream,
    mockTrack,
    triggerEnded: () => endedCallback?.(),
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
let registerSpy: ReturnType<typeof vi.spyOn>;
let unregisterSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  registerSpy = vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
  unregisterSpy = vi.spyOn(MediaScreenWidget, 'unregisterStream').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  MediaScreenWidget._clearRegistryForTest();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useDisplayCapture', () => {
  it('has initial state isCapturing=false and error=null', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia: vi.fn() },
    });
    const { result } = renderHook(() => useDisplayCapture('stream-id'));
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('startCapture() calls getDisplayMedia, registers stream, sets isCapturing=true', async () => {
    const { stream, mockTrack } = createFakeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const { result } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    expect(getDisplayMedia).toHaveBeenCalledOnce();
    expect(registerSpy).toHaveBeenCalledWith('stream-id', stream);
    expect(result.current.isCapturing).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockTrack.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function), { once: true });
  });

  it('startCapture() sets error when getDisplayMedia rejects (NotAllowedError)', async () => {
    const notAllowedError = new DOMException('Permission denied', 'NotAllowedError');
    const getDisplayMedia = vi.fn().mockRejectedValue(notAllowedError);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const { result } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('NotAllowedError');
  });

  it('stopCapture() stops tracks and calls unregisterStream', async () => {
    const { stream, mockTrack } = createFakeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const { result } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    act(() => {
      result.current.stopCapture();
    });

    expect(mockTrack.stop).toHaveBeenCalledOnce();
    expect(unregisterSpy).toHaveBeenCalledWith('stream-id');
    expect(result.current.isCapturing).toBe(false);
  });

  it('component unmount stops tracks and unregisters', async () => {
    const { stream, mockTrack } = createFakeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const { result, unmount } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    unmount();

    expect(mockTrack.stop).toHaveBeenCalledOnce();
    expect(unregisterSpy).toHaveBeenCalledWith('stream-id');
  });

  it('sets error and keeps isCapturing=false when getDisplayMedia is unavailable', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} });

    const { result } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('getDisplayMedia is not supported');
  });

  it('track ended event sets isCapturing=false and calls unregisterStream', async () => {
    const { stream, triggerEnded } = createFakeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });

    const { result } = renderHook(() => useDisplayCapture('stream-id'));

    await act(async () => {
      await result.current.startCapture();
    });

    expect(result.current.isCapturing).toBe(true);

    act(() => {
      triggerEnded();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(unregisterSpy).toHaveBeenCalledWith('stream-id');
  });
});
