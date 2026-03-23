// Tests for telemetry emit abstraction.

import { describe, it, expect, beforeEach } from 'vitest';
import { emit, setEmitFn, resetEmitFn } from '../emit';
import type { WebsiteTelemetryEvent, TelemetryPayloadMap } from '../events';

describe('emit', () => {
  beforeEach(() => {
    resetEmitFn();
  });

  it('calls the custom emit function when set', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    const customEmit = <E extends WebsiteTelemetryEvent>(
      event: E,
      payload: TelemetryPayloadMap[E],
    ): void => {
      collected.push({ event, payload });
    };

    setEmitFn(customEmit);
    emit('section_view', { sectionId: 'hero', sceneId: 'website-hero-00' });

    expect(collected).toHaveLength(1);
    expect(collected[0].event).toBe('section_view');
    expect(collected[0].payload).toEqual({ sectionId: 'hero', sceneId: 'website-hero-00' });
  });

  it('passes correct payload for cta_copy_command', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    setEmitFn((event, payload) => {
      collected.push({ event, payload });
    });

    emit('cta_copy_command', { command: 'npm create brewsite' });

    expect(collected[0].event).toBe('cta_copy_command');
    expect(collected[0].payload).toEqual({ command: 'npm create brewsite' });
  });

  it('passes correct payload for nav_select', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    setEmitFn((event, payload) => {
      collected.push({ event, payload });
    });

    emit('nav_select', { sectionId: 'cta', sceneId: 'website-get-started' });

    expect(collected[0].payload).toEqual({ sectionId: 'cta', sceneId: 'website-get-started' });
  });

  it('passes empty payload for nav_open', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    setEmitFn((event, payload) => {
      collected.push({ event, payload });
    });

    emit('nav_open', {});

    expect(collected[0].event).toBe('nav_open');
    expect(collected[0].payload).toEqual({});
  });

  it('passes webgl_error payload', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    setEmitFn((event, payload) => {
      collected.push({ event, payload });
    });

    emit('webgl_error', { message: 'Context lost' });

    expect(collected[0].event).toBe('webgl_error');
    expect(collected[0].payload).toEqual({ message: 'Context lost' });
  });

  it('resetEmitFn restores default behavior', () => {
    const collected: Array<{ event: string; payload: unknown }> = [];
    setEmitFn((event, payload) => {
      collected.push({ event, payload });
    });

    emit('nav_open', {});
    expect(collected).toHaveLength(1);

    resetEmitFn();
    emit('nav_open', {});
    // After reset, the custom emitter should no longer be called
    expect(collected).toHaveLength(1);
  });
});
