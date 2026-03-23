// Telemetry event types and payload shapes for the website.

/** Telemetry event names emitted by the website. */
export type WebsiteTelemetryEvent =
  | 'section_view'
  | 'nav_open'
  | 'nav_select'
  | 'cta_copy_command'
  | 'cta_github_click'
  | 'reduced_motion_detected'
  | 'webgl_error';

/** Payload for section_view events. */
export type SectionViewPayload = {
  readonly sectionId: string;
  readonly sceneId: string;
};

/** Payload for nav_select events. */
export type NavSelectPayload = {
  readonly sectionId: string;
  readonly sceneId: string;
};

/** Payload for cta_copy_command events. */
export type CommandCopyPayload = {
  readonly command: string;
};

/** Payload for webgl_error events. */
export type WebGLErrorPayload = {
  readonly message: string;
};

/** Union of all telemetry payloads keyed by event name. */
export type TelemetryPayloadMap = {
  section_view: SectionViewPayload;
  nav_open: Record<string, never>;
  nav_select: NavSelectPayload;
  cta_copy_command: CommandCopyPayload;
  cta_github_click: Record<string, never>;
  reduced_motion_detected: Record<string, never>;
  webgl_error: WebGLErrorPayload;
};
