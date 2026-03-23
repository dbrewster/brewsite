// Registers diagram DSL node handlers with @brewsite/core registry.

import type { ReactElement } from 'react';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers, WidgetRegistry, SceneLength, SceneAngle } from '@brewsite/core';
import { resolveToNVS } from '@brewsite/core';
import { compileDiagram } from '../elements/diagram/compile';
import { resolveDiagramTheme } from '../elements/diagram/themeRegistry';
import type {
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramWarnFn,
  LayoutDSL,
  DiagramState,
} from '../elements/diagram/types';
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
  DiagramWidget,
} from '../elements/diagram/widget';
import { buildThemeRenderConfig } from '../elements/diagram/compiler/themeResolver';
import { defaultDiagramTheme } from '../elements/diagram/themes';


const extractDiagramDSL = (node: ReactElement, helpers: CompileHelpers, warnFn?: DiagramWarnFn): DiagramDSL => {
  const props = node.props as Record<string, unknown>;
  const nodes: DiagramNodeDSL[] = [];
  const edges: DiagramEdgeDSL[] = [];
  const groups: DiagramGroupDSL[] = [];
  const groupedNodeIds = new Set<string>();
  let exitDSL: DiagramExitDSL | undefined;
  let enterDSL: DiagramEnterDSL | undefined;
  let layoutDSL: LayoutDSL | undefined;

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
      edgeLights:   elProps.edgeLights as DiagramGroupDSL['edgeLights'],
      labelColor:   elProps.labelColor as string | undefined,
      backColor:    elProps.backColor as string | undefined,
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
    x: props.x as SceneLength | undefined,
    y: props.y as SceneLength | undefined,
    w: props.w as SceneLength | undefined,
    h: props.h as SceneLength | undefined,
    tilt: props.tilt as SceneAngle | undefined,
    z: props.z as number | undefined,
    scale: props.scale as number | undefined,
    exit: exitDSL,
    enter: enterDSL,
  };
};

/**
 * Creates a default DiagramState for use as the DiagramWidget's initial state.
 * All fields are set to safe defaults; the actual state comes from compiled DSL.
 */
function makeDefaultDiagramState(id: string): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: buildThemeRenderConfig(defaultDiagramTheme),
  };
}

/**
 * @internal
 * Registers all diagram DSL node handlers with the @brewsite/core compiler registry.
 * Called automatically at module-load time via packages/diagram/src/register.ts.
 * Not part of the public @brewsite/diagram API.
 * Test files that call clearRegistry() must import and re-call this directly.
 *
 * @param registry - When provided, the Diagram handler will lazily register a
 *   DiagramWidget into the registry on first DSL encounter. This is used by
 *   diagramPlugin.configureRegistry() to enable zero-config widget creation.
 */
export const registerDiagramHandlers = (registry?: WidgetRegistry): void => {
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
  registerNode(GridLayout, () => {});
  registerNode(HierarchicalLayout, () => {});
  registerNode(ManualLayout, () => {});
  registerNode(FlowLayout, () => {});

  registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    const onWarn = makeWarnFn(api);
    const dsl = extractDiagramDSL(node, helpers, onWarn);

    // Resolve theme from engine context via registry.
    const resolvedTheme = resolveDiagramTheme(
      api.context.themeFamily,
      api.context.themePolarity,
    );

    // Bridge engine-level SceneTheme into DiagramTheme so that
    // buildThemeRenderConfig() can derive fontUrl and fontSize multipliers.
    const themedResolvedTheme = api.context.sceneTheme
      ? { ...resolvedTheme, sceneTheme: api.context.sceneTheme }
      : resolvedTheme;

    // Compose local [0..1] bounds and Z through the parent NVS context.
    // This is essential when <Diagram> is nested inside a <View> or other scoped
    // container — without it, viewportBounds ignores the parent coordinate system
    // (carousel scale, view position, etc.) and the diagram renders at the wrong size.
    const localBounds = {
      x: dsl.x !== undefined ? resolveToNVS(dsl.x) : 0,
      y: dsl.y !== undefined ? resolveToNVS(dsl.y) : 0,
      w: dsl.w !== undefined ? resolveToNVS(dsl.w) : 1,
      h: dsl.h !== undefined ? resolveToNVS(dsl.h) : 1,
    };
    const composedBounds = api.composeBounds(localBounds);
    const composedZ = api.composeZ(dsl.z ?? 0);

    // Compose view opacity (carousel fade, nested view fade, etc.) into all per-element
    // opacities at compile time. Each scene's compiled state gets the right reduced
    // opacities baked in, so the transition spec blends them correctly without any
    // renderer changes needed.
    const viewOpacity = api.composeOpacity(1);

    // Pass composed numeric bounds back as SceneLength '%' strings for compile.ts
    const xLen = `${composedBounds.x * 100}%` as SceneLength;
    const yLen = `${composedBounds.y * 100}%` as SceneLength;
    const wLen = `${composedBounds.w * 100}%` as SceneLength;
    const hLen = `${composedBounds.h * 100}%` as SceneLength;

    let diagramState = compileDiagram(
      { ...dsl, x: xLen, y: yLen, w: wLen, h: hLen, z: composedZ },
      themedResolvedTheme,
      onWarn,
    );

    if (viewOpacity < 1) {
      diagramState = {
        ...diagramState,
        nodes: diagramState.nodes.map((n) => ({ ...n, opacity: n.opacity * viewOpacity })),
        edges: diagramState.edges.map((e) => ({ ...e, opacity: e.opacity * viewOpacity })),
        groups: diagramState.groups.map((g) => ({
          ...g,
          fillOpacity: g.fillOpacity * viewOpacity,
          borderOpacity: g.borderOpacity * viewOpacity,
        })),
      };
    }

    // Lazily create and register a DiagramWidget. Prefer the per-compilation
    // registry from api.context (multi-engine safe) over the closure-captured
    // registry (single-engine backward compat).
    const reg = api.context.widgetRegistry ?? registry;
    if (reg && !reg.get(dsl.id)) {
      const widget = new DiagramWidget(dsl.id, makeDefaultDiagramState(dsl.id));
      widget.setRegistry(reg);
      reg.register(widget);
    }

    api.setWidgetState(dsl.id, diagramState);
  });
};
