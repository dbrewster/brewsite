import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WheelCaptureDemo } from '../WheelCaptureDemo';
import type { DemoCaptureContextValue } from '../DemoCaptureContext';

function makeCaptureCtx(progressValue: number): DemoCaptureContextValue & { onWheelDelta: ReturnType<typeof vi.fn> } {
  return {
    onWheelDelta: vi.fn(),
    registerEngine: vi.fn().mockReturnValue(() => {}),
    getProgress: () => progressValue,
    scrollUnits: 2400,
  };
}

describe('WheelCaptureDemo', () => {
  it('calls onWheelDelta with normalized delta when active and within bounds', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    // jsdom does not support non-passive listeners well; test via direct dispatch.
    const el = container.firstChild as HTMLElement;
    const event = new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(ctx.onWheelDelta).toHaveBeenCalledWith(100);
  });

  it('does NOT call onWheelDelta when active is false', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={false} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('does NOT intercept ctrlKey wheel events (browser zoom)', () => {
    const ctx = makeCaptureCtx(0.5);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('passes through at progress 0 scrolling up (negative delta)', () => {
    const ctx = makeCaptureCtx(0);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('passes through at progress 1 scrolling down (positive delta)', () => {
    const ctx = makeCaptureCtx(1);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).not.toHaveBeenCalled();
  });

  it('intercepts at progress 1 scrolling up (negative delta)', () => {
    const ctx = makeCaptureCtx(1);
    const { container } = render(
      <WheelCaptureDemo active={true} captureCtx={ctx}>content</WheelCaptureDemo>
    );
    const el = container.firstChild as HTMLElement;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true, cancelable: true }));
    expect(ctx.onWheelDelta).toHaveBeenCalledWith(-100);
  });
});
