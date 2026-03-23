// Tests for telemetry event type integrity.

import { describe, it, expect } from 'vitest';
import type {
  WebsiteTelemetryEvent,
  SectionViewPayload,
  NavSelectPayload,
  CommandCopyPayload,
  WebGLErrorPayload,
  TelemetryPayloadMap,
} from '../events';

describe('telemetry event types', () => {
  it('SectionViewPayload has expected shape', () => {
    const payload: SectionViewPayload = { sectionId: 'hero', sceneId: 'website-hero-00' };
    expect(payload.sectionId).toBe('hero');
    expect(payload.sceneId).toBe('website-hero-00');
  });

  it('NavSelectPayload has expected shape', () => {
    const payload: NavSelectPayload = { sectionId: 'cta', sceneId: 'website-get-started' };
    expect(payload.sectionId).toBe('cta');
    expect(payload.sceneId).toBe('website-get-started');
  });

  it('CommandCopyPayload has expected shape', () => {
    const payload: CommandCopyPayload = { command: 'npm create brewsite' };
    expect(payload.command).toBe('npm create brewsite');
  });

  it('WebGLErrorPayload has expected shape', () => {
    const payload: WebGLErrorPayload = { message: 'Context lost' };
    expect(payload.message).toBe('Context lost');
  });

  it('TelemetryPayloadMap maps all events', () => {
    // Type-level test: ensure the map covers all events.
    const map: Record<WebsiteTelemetryEvent, keyof TelemetryPayloadMap> = {
      section_view: 'section_view',
      nav_open: 'nav_open',
      nav_select: 'nav_select',
      cta_copy_command: 'cta_copy_command',
      cta_github_click: 'cta_github_click',
      reduced_motion_detected: 'reduced_motion_detected',
      webgl_error: 'webgl_error',
    };
    expect(Object.keys(map)).toHaveLength(7);
  });
});
