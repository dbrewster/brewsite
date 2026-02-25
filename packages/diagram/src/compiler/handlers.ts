// Registers diagram, image-panel, and screen DSL node handlers with @brewsite/core registry.

import type { ReactElement } from 'react';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { compileDiagram } from '../elements/diagram/compile';
import { compileImagePanel } from '../elements/image-panel/compile';
import { compileScreen } from '../elements/screen/compile';
import type {
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
} from '../elements/diagram/types';
import type { ImagePanelDSL } from '../elements/image-panel/types';
import type { ScreenDSL } from '../elements/screen/types';
import { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from '../elements/diagram/dsl';
import { ImagePanel } from '../elements/image-panel/dsl';
import { Screen } from '../elements/screen/dsl';

const extractDiagramDSL = (node: ReactElement, helpers: CompileHelpers): DiagramDSL => {
  const props = node.props as Record<string, unknown>;
  const nodes: DiagramNodeDSL[] = [];
  const edges: DiagramEdgeDSL[] = [];
  const groups: DiagramGroupDSL[] = [];
  const groupedNodeIds = new Set<string>();

  const allChildren = helpers.collectChildren(node);

  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    const elProps = el.props as Record<string, unknown>;
    if (el.type !== DiagramGroup) continue;

    const groupChildren = helpers.collectChildren(el);
    const nodeIds: string[] = [];
    for (const gc of groupChildren) {
      if (!gc || typeof gc !== 'object' || !('type' in (gc as object))) continue;
      const gEl = gc as ReactElement;
      if (gEl.type === DiagramNode) {
        const nodeId = String((gEl.props as Record<string, unknown>).id);
        nodeIds.push(nodeId);
        groupedNodeIds.add(nodeId);
        nodes.push({ ...(gEl.props as DiagramNodeDSL), groupId: String(elProps.id) });
      }
    }

    groups.push({
      id: String(elProps.id),
      label: String(elProps.label ?? ''),
      variant: elProps.variant as DiagramGroupDSL['variant'],
      orientation: elProps.orientation as DiagramGroupDSL['orientation'],
      color: elProps.color as string | undefined,
      borderColor: elProps.borderColor as string | undefined,
      borderStyle: elProps.borderStyle as DiagramGroupDSL['borderStyle'],
      fillOpacity: elProps.fillOpacity as number | undefined,
      borderOpacity: elProps.borderOpacity as number | undefined,
      nodeIds,
    });
  }

  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type === DiagramNode) {
      const id = String((el.props as Record<string, unknown>).id);
      if (!groupedNodeIds.has(id)) {
        nodes.push(el.props as DiagramNodeDSL);
      }
    } else if (el.type === DiagramEdge) {
      edges.push(el.props as DiagramEdgeDSL);
    }
  }

  return {
    id: String(props.id),
    layout: (props.layout ?? 'grid') as DiagramDSL['layout'],
    layoutSpacing: (props.layoutSpacing ?? [2, 2]) as [number, number],
    nodes,
    edges,
    groups,
  };
};

export const registerDiagramHandlers = (): void => {
  // Register child DSL components as primitives so collectChildren preserves them.
  registerNode(DiagramNode, () => {});
  registerNode(DiagramEdge, () => {});
  registerNode(DiagramGroup, () => {});

  registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    const dsl = extractDiagramDSL(node, helpers);
    const state = compileDiagram(dsl);
    const widgetId = String((node.props as { id?: string }).id ?? dsl.id);
    api.setWidgetState(widgetId, state);
  });

  registerNode(ImagePanel, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
    const dsl = node.props as ImagePanelDSL;
    const state = compileImagePanel(dsl);
    api.setWidgetState(String((node.props as { id?: string }).id ?? dsl.id), state);
  });

  registerNode(Screen, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
    const dsl = node.props as ScreenDSL;
    const state = compileScreen(dsl);
    api.setWidgetState(String((node.props as { id?: string }).id ?? dsl.id), state);
  });
};
