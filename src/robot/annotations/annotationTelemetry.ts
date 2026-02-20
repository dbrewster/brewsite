export type AnnotationTelemetryPayload = Record<string, unknown>;

export const logAnnotationWarning = (code: string, payload: AnnotationTelemetryPayload) => {
  console.warn('[RobotAnnotations]', code, payload);
};

export const logAnnotationError = (code: string, payload: AnnotationTelemetryPayload) => {
  console.error('[RobotAnnotations]', code, payload);
};
