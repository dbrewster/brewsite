import type {ModelPartAnchor, ModelPartId, ModelSubpartId, ModelSubpartSpec, SceneFrame, Vec3,} from './robotSceneTypes';

export type AttachmentPayload =
  | { type: 'model'; modelId: string }
  | { type: 'component'; componentType: string };

export type AttachmentRender = {
  opacity?: number;
  subparts?: Partial<Record<ModelSubpartId, ModelSubpartSpec>>;
};

export type AttachmentSpec = {
  id: ModelPartId;
  anchor: ModelPartAnchor;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  payload: AttachmentPayload;
  render: AttachmentRender;
};

export function resolveAttachments(scene: SceneFrame, modelId: string): AttachmentSpec[] {
  const parts = scene.models?.[modelId]?.model.parts;
  if (!parts) return [];
  const attachments: AttachmentSpec[] = [];

  for (const part of Object.values(parts)) {
    if (!part.enabled) continue;
    if (!part.modelId) continue;
    const payload: AttachmentPayload = { type: 'model', modelId: part.modelId };
    const render: AttachmentRender = {
      opacity: part.opacity,
      subparts: part.subparts,
    };
    attachments.push({
      id: part.id,
      anchor: part.anchor,
      position: part.position,
      rotation: part.rotation,
      scale: part.scale,
      payload,
      render,
    });
  }

  return attachments;
}
