// Registers diagram, image-panel, and screen DSL node handlers with @brewsite/core registry.

import type { ReactElement } from 'react';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { compileDiagram } from '../elements/diagram/compile';
import { DiagramCanvas, DiagramPipe } from '../elements/diagram/canvas/dsl';
import { compileCanvas } from '../elements/diagram/canvas/compile';
import { compileImagePanel } from '../elements/image-panel/compile';
import { compileScreen } from '../elements/screen/compile';
import type {
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramPivot,
  DiagramState,
  DiagramTheme,
  DiagramWarnFn,
  LayoutDSL,
} from '../elements/diagram/types';
import type { InputActionSpec } from '@brewsite/core';
import type { DiagramCanvasDSL, DiagramPipeDSL, PipeRoutingAlgorithm, PipeLandingAlgorithm } from '../elements/diagram/canvas/types';
import type { ImagePanelDSL } from '../elements/image-panel/types';
import type { ScreenDSL } from '../elements/screen/types';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramExit,
  DiagramEnter,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  FlowLayout,
} from '../elements/diagram/dsl';
import { ImagePanel } from '../elements/image-panel/dsl';
import { Screen } from '../elements/screen/dsl';

const extractDiagramDSL = (node: ReactElement, helpers: CompileHelpers, warnFn?: DiagramWarnFn): DiagramDSL => {
  const props = node.props as Record<string, unknown>;
  const nodes: DiagramNodeDSL[] = [];
  const edges: DiagramEdgeDSL[] = [];
  const groups: DiagramGroupDSL[] = [];
  const groupedNodeIds = new Set<string>();
  let exitDSL: DiagramExitDSL | undefined;
  let enterDSL: DiagramEnterDSL | undefined;
  let layoutDSL: LayoutDSL | undefined;
  const theme = props.theme as DiagramTheme | undefined;

  const allChildren = helpers.collectChildren(node);

  const extractLayoutProps = (p: Record<string, unknown>) => ({
    ...(p.spacing !== undefined && { spacing: p.spacing }),
    ...(p.margin !== undefined && { margin: p.margin }),
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
    ...(p.alignment !== undefined && { alignment: p.alignment }),
    ...(p.disconnected !== undefined && { disconnected: p.disconnected }),
    ...(p.columns !== undefined && { columns: p.columns }),
    ...(p.direction !== undefined && { direction: p.direction }),
  });
  const extractManualLayoutProps = (p: Record<string, unknown>) => ({
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
  });
  const extractFlowLayoutProps = (p: Record<string, unknown>) => ({
    ...(p.gap !== undefined && { gap: p.gap }),
    ...(p.direction !== undefined && { direction: p.direction }),
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
  });

  const collectGroup = (el: ReactElement, parentId?: string, warnFn?: DiagramWarnFn): string => {
    const elProps = el.props as Record<string, unknown>;
    const groupId = String(elProps.id);
    const nodeIds: string[] = [];
    const childGroupIds: string[] = [];
    const childrenOrder: string[] = [];
    let groupLayoutDSL: LayoutDSL | undefined;
    const groupChildren = helpers.collectChildren(el);
    for (const gc of groupChildren) {
      if (!gc || typeof gc !== 'object' || !('type' in (gc as object))) continue;
      const gEl = gc as ReactElement;
      if (gEl.type === DiagramNode) {
        const nodeId = String((gEl.props as Record<string, unknown>).id);
        nodeIds.push(nodeId);
        childrenOrder.push(nodeId);
        groupedNodeIds.add(nodeId);
        nodes.push({ ...(gEl.props as DiagramNodeDSL), groupId });
      } else if (gEl.type === DiagramGroup) {
        const childId = collectGroup(gEl, groupId, warnFn);
        childGroupIds.push(childId);
        childrenOrder.push(childId);
      } else if (gEl.type === GridLayout) {
        const p = gEl.props as Record<string, unknown>;
        if (groupLayoutDSL) {
          console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
        }
        groupLayoutDSL = { kind: 'grid', ...extractLayoutProps(p) } as LayoutDSL;
      } else if (gEl.type === HierarchicalLayout) {
        const p = gEl.props as Record<string, unknown>;
        if (groupLayoutDSL) {
          console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
        }
        groupLayoutDSL = { kind: 'hierarchical', ...extractLayoutProps(p) } as LayoutDSL;
      } else if (gEl.type === ManualLayout) {
        const p = gEl.props as Record<string, unknown>;
        if (groupLayoutDSL) {
          console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
        }
        groupLayoutDSL = { kind: 'manual', ...extractManualLayoutProps(p) } as LayoutDSL;
      } else if (gEl.type === FlowLayout) {
        const p = gEl.props as Record<string, unknown>;
        if (groupLayoutDSL) {
          console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
        }
        groupLayoutDSL = { kind: 'flow', ...extractFlowLayoutProps(p) } as LayoutDSL;
      } else if (gEl.type === DiagramEnter || gEl.type === DiagramExit) {
        const componentName = gEl.type === DiagramEnter ? 'DiagramEnter' : 'DiagramExit';
        warnFn?.(
          'MISPLACED_DIAGRAM_TRANSITION',
          `<${componentName}> found inside <DiagramGroup id="${groupId}">. ` +
            `<${componentName}> must be a direct child of <Diagram>, not nested inside a group. ` +
            `Move it to be a sibling of the top-level <DiagramNode> and <DiagramGroup> elements.`,
        );
      }
    }

    groups.push({
      id: groupId,
      label: elProps.label !== undefined ? String(elProps.label) : undefined,
      variant: elProps.variant as DiagramGroupDSL['variant'],
      orientation: elProps.orientation as DiagramGroupDSL['orientation'],
      color: elProps.color as string | undefined,
      borderColor: elProps.borderColor as string | undefined,
      borderStyle: elProps.borderStyle as DiagramGroupDSL['borderStyle'],
      fillOpacity: elProps.fillOpacity as number | undefined,
      borderOpacity: elProps.borderOpacity as number | undefined,
      borderEmissiveColor: elProps.borderEmissiveColor as string | undefined,
      borderEmissiveIntensity: elProps.borderEmissiveIntensity as number | undefined,
      onMouseEnter: elProps.onMouseEnter as DiagramGroupDSL['onMouseEnter'],
      onMouseLeave: elProps.onMouseLeave as DiagramGroupDSL['onMouseLeave'],
      edgeLights: elProps.edgeLights as DiagramGroupDSL['edgeLights'],
      nodeIds,
      childGroupIds: childGroupIds.length > 0 ? childGroupIds : undefined,
      childrenOrder,
      parentId,
      layout: groupLayoutDSL,
    });

    return groupId;
  };

  const childrenOrder: string[] = [];
  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type === DiagramNode) {
      childrenOrder.push(String((el.props as Record<string, unknown>).id));
    } else if (el.type === DiagramGroup) {
      childrenOrder.push(String((el.props as Record<string, unknown>).id));
    }
  }

  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type === GridLayout) {
      const p = el.props as Record<string, unknown>;
      if (layoutDSL) {
        console.warn(`Diagram extractDiagramDSL: multiple layout elements detected for diagram ${String(props.id)}. Using the last one.`);
      }
      layoutDSL = { kind: 'grid', ...extractLayoutProps(p) } as LayoutDSL;
    } else if (el.type === HierarchicalLayout) {
      const p = el.props as Record<string, unknown>;
      if (layoutDSL) {
        console.warn(`Diagram extractDiagramDSL: multiple layout elements detected for diagram ${String(props.id)}. Using the last one.`);
      }
      layoutDSL = { kind: 'hierarchical', ...extractLayoutProps(p) } as LayoutDSL;
    } else if (el.type === ManualLayout) {
      const p = el.props as Record<string, unknown>;
      if (layoutDSL) {
        console.warn(`Diagram extractDiagramDSL: multiple layout elements detected for diagram ${String(props.id)}. Using the last one.`);
      }
      layoutDSL = { kind: 'manual', ...extractManualLayoutProps(p) } as LayoutDSL;
    } else if (el.type === FlowLayout) {
      const p = el.props as Record<string, unknown>;
      if (layoutDSL) {
        console.warn(`Diagram extractDiagramDSL: multiple layout elements detected for diagram ${String(props.id)}. Using the last one.`);
      }
      layoutDSL = { kind: 'flow', ...extractFlowLayoutProps(p) } as LayoutDSL;
    } else if (el.type === DiagramExit) {
      if (exitDSL) {
        warnFn?.('DUPLICATE_DIAGRAM_TRANSITION', `<Diagram id="${String(props.id)}">: multiple <DiagramExit> elements found. Only the last one is used.`);
      }
      exitDSL = el.props as DiagramExitDSL;
    } else if (el.type === DiagramEnter) {
      if (enterDSL) {
        warnFn?.('DUPLICATE_DIAGRAM_TRANSITION', `<Diagram id="${String(props.id)}">: multiple <DiagramEnter> elements found. Only the last one is used.`);
      }
      enterDSL = el.props as DiagramEnterDSL;
    } else if (el.type === DiagramGroup) {
      collectGroup(el, undefined, warnFn);
    }
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
    layout: layoutDSL,
    nodes,
    edges,
    groups,
    childrenOrder,
    position: props.position as readonly [number, number, number] | undefined,
    rotation: props.rotation as readonly [number, number, number] | undefined,
    scale: props.scale as number | undefined,
    pivot: (props.pivot ?? 'center') as DiagramPivot,
    exit: exitDSL,
    enter: enterDSL,
    theme,
  };
};

/**
 * @internal
 * Registers all diagram DSL node handlers with the @brewsite/core compiler registry.
 * Called automatically at module-load time via packages/diagram/src/register.ts.
 * Not part of the public @brewsite/diagram API.
 * Test files that call clearRegistry() must import and re-call this directly.
 */
export const registerDiagramHandlers = (): void => {
  const makeWarnFn = (api: CompileApi): DiagramWarnFn => (code, message) => {
    const warnApi = api as CompileApi & {
      pushWarning?: (w: { code: string; message: string; sceneIndex?: number }) => void;
    };
    warnApi.pushWarning?.({ code, message, sceneIndex: api.context.sceneIndex });
  };

  // Register child DSL components as primitives so collectChildren preserves them.
  registerNode(DiagramNode, () => {});
  registerNode(DiagramEdge, () => {});
  registerNode(DiagramGroup, () => {});
  registerNode(DiagramExit, () => {});
  registerNode(DiagramEnter, () => {});
  registerNode(DiagramPipe, () => {});

  registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    const onWarn = makeWarnFn(api);
    const dsl = extractDiagramDSL(node, helpers, onWarn);

    // Warn if standalone <Diagram> theme has input — this is the wrong authoring level.
    // theme.input is only effective on <DiagramCanvas>, not on a bare <Diagram>.
    if (dsl.theme?.input !== undefined) {
      onWarn(
        'IGNORED_INPUT_CONFIG',
        `<Diagram id="${dsl.id}"> has a theme with an "input" section. ` +
          `theme.input is only effective on <DiagramCanvas>. ` +
          `Wrap this diagram in a <DiagramCanvas theme={...}> to use input defaults.`,
      );
    }

    const diagramState = compileDiagram(dsl, undefined, onWarn);
    const canvasId = dsl.id;

    // Wrap the single diagram in a canvas state — DiagramCanvasWidget expects DiagramCanvasState.
    const canvasState = compileCanvas(
      {
        id: canvasId,
        position: dsl.position,
        rotation: dsl.rotation,
        scale: dsl.scale,
      },
      [diagramState],
      [],
      onWarn,
    );

    api.setWidgetState(canvasId, canvasState);
  });

  registerNode(DiagramCanvas, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    const props = node.props as Record<string, unknown>;
    const allChildren = helpers.collectChildren(node);
    const canvasTheme = props.theme as DiagramTheme | undefined;
    const canvasId = String(props.id);
    const onWarn = makeWarnFn(api);

    const diagramStates: DiagramState[] = [];
    for (const child of allChildren) {
      if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
      const el = child as ReactElement;
      if (el.type !== Diagram) continue;
      const dsl = extractDiagramDSL(el, helpers, onWarn);

      // Warn if a child <Diagram> has theme.input — this is the wrong authoring level.
      // theme.input is only effective on <DiagramCanvas>, not on its <Diagram> children.
      if (dsl.theme?.input !== undefined) {
        onWarn(
          'IGNORED_INPUT_CONFIG',
          `<Diagram id="${dsl.id}"> inside <DiagramCanvas id="${canvasId}">: ` +
            `theme.input is ignored on child <Diagram> elements. ` +
            `Move theme.input to the <DiagramCanvas theme={...}> instead.`,
        );
      }

      // Pass canvas theme as fallback; diagram's own theme (if any) overrides inside compileDiagram
      diagramStates.push(compileDiagram(dsl, canvasTheme, onWarn));
    }

    const pipeDSLs: DiagramPipeDSL[] = [];
    for (const child of allChildren) {
      if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
      const el = child as ReactElement;
      if (el.type !== DiagramPipe) continue;
      pipeDSLs.push(el.props as DiagramPipeDSL);
    }

    // Compile default input actions from theme.input, injecting canvasId into each action.
    let defaultInputActions: ReadonlyArray<InputActionSpec> | undefined;
    if (canvasTheme?.input?.defaultActions && canvasTheme.input.defaultActions.length > 0) {
      defaultInputActions = canvasTheme.input.defaultActions.map((action) => ({
        ...action,
        canvasId,
      }));
    }

    const canvasDSL: DiagramCanvasDSL = {
      id: canvasId,
      position: props.position as readonly [number, number, number] | undefined,
      rotation: props.rotation as readonly [number, number, number] | undefined,
      scale: props.scale as number | undefined,
      theme: canvasTheme,
      pipeRouting: props.pipeRouting as PipeRoutingAlgorithm | undefined,
      pipeLanding: props.pipeLanding as PipeLandingAlgorithm | undefined,
      focusCenter: props.focusCenter as readonly [number, number] | readonly [number, number, number] | undefined,
    };

    const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs, onWarn, defaultInputActions);
    api.setWidgetState(canvasId, canvasState);
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
