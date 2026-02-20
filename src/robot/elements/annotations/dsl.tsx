import type {ReactElement, ReactNode} from 'react';
import type {AnnotationDefinition, AnnotationLabelAnchor, AnnotationTarget} from './types';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi, CompileHelpers} from '../../runtime/compiler/sceneDslTypes';

export type AnnotationsProps = {
  children?: ReactNode;
};

export const Annotations = (_props: AnnotationsProps) => null;

registerNode(Annotations, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  api.state.annotations = [];
  helper.compileChildren(node, api);
});

export type AnnotationProps = {
  id: string;
  label?: string;
  mode?: 'world' | 'screen';
  contentId?: string;
  content?: {
    label?: ReactNode;
    hud?: ReactNode;
    node?: ReactNode;
    fullscreen?: boolean;
  };
  targetPartId?: string;
  targetPoint?: [number, number, number];
  target?: {
    targetPartId?: string;
    targetPoint?: [number, number, number];
  };
  labelOffset?: [number, number, number];
  labelAnchor?: {
    reference: { x: 'left' | 'center' | 'right' | 'model'; y: 'top' | 'center' | 'bottom' | 'model' };
    offset: { xPct: number; yPct: number };
  } | { labelPosition: [number, number, number] } | { labelOffset: [number, number, number] };
  worldScale?: number;
  style?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  enabled?: boolean;
};

export const Annotation = (_props: AnnotationProps) => null;

registerNode(Annotation, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const props = node.props as AnnotationProps;
  const resolvedStyle = props.style
    ? helper.stripUndefinedDeep(helper.resolveObjectValues(props.style as Record<string, unknown>, api.context))
    : undefined;
  const resolvedVisibility = props.visibility
    ? helper.stripUndefinedDeep(helper.resolveObjectValues(props.visibility as Record<string, unknown>, api.context))
    : undefined;
  const resolvedTarget = props.target
    ? helper.stripUndefinedDeep(helper.resolveObjectValues(props.target as Record<string, unknown>, api.context))
    : undefined;
  const resolvedLabelAnchor = props.labelAnchor
    ? helper.stripUndefinedDeep(helper.resolveObjectValues(props.labelAnchor as Record<string, unknown>, api.context))
    : undefined;

  const target = (resolvedTarget && Object.keys(resolvedTarget).length > 0
    ? resolvedTarget
    : props.targetPartId
      ? { targetPartId: props.targetPartId }
      : props.targetPoint
        ? { targetPoint: props.targetPoint }
        : undefined) as AnnotationTarget | undefined;
  const labelAnchor = (resolvedLabelAnchor && Object.keys(resolvedLabelAnchor).length > 0
    ? resolvedLabelAnchor
    : props.labelOffset
      ? { labelOffset: props.labelOffset }
      : undefined) as AnnotationLabelAnchor | undefined;
  const label = props.label ?? props.id;
  const annotation: AnnotationDefinition = {
    id: props.id,
    label,
    mode: props.mode,
    contentId: props.contentId,
    content: props.content,
    target,
    labelAnchor,
    worldScale: props.worldScale,
    visibility: resolvedVisibility && Object.keys(resolvedVisibility).length > 0 ? resolvedVisibility : undefined,
    enabled: props.enabled,
    style: resolvedStyle && Object.keys(resolvedStyle).length > 0 ? resolvedStyle : undefined,
  };
  api.pushAnnotation(annotation);
});
