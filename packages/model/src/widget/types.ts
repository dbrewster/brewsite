// Model-specific widget contracts for @brewsite/model.
import type { IRenderable, IContainedRenderable } from '@brewsite/core';

/**
 * Widget whose rootObject is a model anchored to a bone on another ModelWidget.
 *
 * anchorWidgetId must be the widgetId of a registered ModelWidget that implements
 * IAttachmentHost. anchorKey is resolved via ModelWidget.getAttachmentPoint(key).
 *
 * This is the model-specific extension of IContainedRenderable. Use the generic
 * IContainedRenderable from @brewsite/core for non-model attachment cases.
 */
export interface IContainedModel<TState> extends IRenderable<TState>, IContainedRenderable {
  // anchorWidgetId is always a ModelWidget widgetId.
  // anchorKey is resolved by ModelWidget.getAttachmentPoint() via bone name lookup.
}
