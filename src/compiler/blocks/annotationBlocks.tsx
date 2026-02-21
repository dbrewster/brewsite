import type { ReactNode } from 'react';
import { registerNode } from '../registry';
import type { AnnotationContent, AnnotationDefinition, AnnotationPlacement, AnnotationStyle } from '../../annotations/annotationTypes';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';
import type { SceneSnapshotContext } from '../sceneTypes';

export type AnnotationsProps = {
  children?: ReactNode;
};

export type MessageAnnotationProps = {
  id: string;
  label?: string | ((context: SceneSnapshotContext) => string);
  enabled?: boolean | ((context: SceneSnapshotContext) => boolean);
  content?: ReactNode;
  contentId?: string;
  placement?: AnnotationPlacement | ((context: SceneSnapshotContext) => AnnotationPlacement);
  style?: Partial<AnnotationStyle> | ((context: SceneSnapshotContext) => Partial<AnnotationStyle>);
  children?: ReactNode;
};

const DEFAULT_MESSAGE_PLACEMENT: AnnotationPlacement = {
  mode: 'fixed',
  reference: { x: 'center', y: 'middle' },
  offset: { xPct: 0, yPct: 0 },
};

export const Annotations = (_props: AnnotationsProps) => null;
Annotations.displayName = 'Annotations';

export const MessageAnnotation = (_props: MessageAnnotationProps) => null;
MessageAnnotation.displayName = 'MessageAnnotation';

const resolveContent = (props: MessageAnnotationProps): AnnotationContent | undefined => {
  if (props.contentId) return { contentId: props.contentId };
  if (props.content !== undefined) return { node: props.content };
  if (props.children !== undefined) return { node: props.children };
  return undefined;
};

const resolvePlacement = (
  props: MessageAnnotationProps,
  api: CompileApi,
  helpers: CompileHelpers,
): AnnotationPlacement => {
  const placement = helpers.resolveValue(props.placement ?? DEFAULT_MESSAGE_PLACEMENT, api.context);
  return helpers.resolveObjectValues(placement as Record<string, unknown>, api.context) as AnnotationPlacement;
};

const resolveStyle = (
  props: MessageAnnotationProps,
  api: CompileApi,
  helpers: CompileHelpers,
): Partial<AnnotationStyle> | undefined => {
  if (!props.style) return undefined;
  const style = helpers.resolveValue(props.style, api.context);
  const resolved = helpers.resolveObjectValues(style as Record<string, unknown>, api.context);
  const cleaned = helpers.stripUndefinedDeep(resolved as Record<string, unknown>);
  return Object.keys(cleaned).length > 0 ? (cleaned as Partial<AnnotationStyle>) : undefined;
};

registerNode(Annotations, (node, api, helpers) => {
  helpers.compileChildren(node, api);
});

registerNode(MessageAnnotation, (node, api, helpers) => {
  const props = node.props as MessageAnnotationProps;
  const label = helpers.resolveValue(props.label ?? props.id, api.context);
  const enabled = props.enabled === undefined ? undefined : helpers.resolveValue(props.enabled, api.context);
  const placement = resolvePlacement(props, api, helpers);
  const style = resolveStyle(props, api, helpers);
  const content = resolveContent(props);

  const annotation: AnnotationDefinition = {
    id: props.id,
    label,
    enabled,
    content,
    placement,
    style,
  };

  api.pushAnnotation(annotation);
});
