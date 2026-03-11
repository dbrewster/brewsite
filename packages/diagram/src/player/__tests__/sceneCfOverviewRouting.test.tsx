import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { Scene, WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../../core/src/compiler/sceneTrackCompiler';
import { clearRegistry } from '../../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../../core/src/compiler/coreHandlers';
import { diagramPlugin } from '../diagramPlugin';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  FlowLayout,
  GridLayout,
} from '../../elements/diagram/widget';
import type { DiagramState } from '../../elements/diagram/types';

const EPSILON = 1e-6;
const CUBIC_SAMPLES = 24;

type Rect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

const nodeRect = (node: DiagramState['nodes'][number]): Rect => ({
  left: node.position[0] - node.size[0] / 2,
  right: node.position[0] + node.size[0] / 2,
  top: node.position[1] - node.size[1] / 2,
  bottom: node.position[1] + node.size[1] / 2,
});

const groupRect = (group: DiagramState['groups'][number]): Rect => ({
  left: group.bounds.x,
  right: group.bounds.x + group.bounds.w,
  top: group.bounds.y,
  bottom: group.bounds.y + group.bounds.h,
});

const pointInsideRect = (
  point: readonly [number, number, number],
  rect: Rect,
): boolean => (
  point[0] > rect.left + EPSILON &&
  point[0] < rect.right - EPSILON &&
  point[1] > rect.top + EPSILON &&
  point[1] < rect.bottom - EPSILON
);

const sampleCubicPoint = (
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  p3: readonly [number, number, number],
  t: number,
): readonly [number, number, number] => {
  const oneMinusT = 1 - t;
  const a = oneMinusT ** 3;
  const b = 3 * oneMinusT ** 2 * t;
  const c = 3 * oneMinusT * t ** 2;
  const d = t ** 3;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
};

const sampleEdgePath = (edge: DiagramState['edges'][number]): ReadonlyArray<readonly [number, number, number]> => {
  const samples: Array<readonly [number, number, number]> = [];
  for (const command of edge.path.commands) {
    if (command.kind === 'line') {
      samples.push(command.from, command.to);
      continue;
    }
    for (let index = 0; index <= CUBIC_SAMPLES; index += 1) {
      samples.push(sampleCubicPoint(command.p0, command.p1, command.p2, command.p3, index / CUBIC_SAMPLES));
    }
  }
  return samples;
};

const collectAllowedGroupIdsForEdge = (
  state: DiagramState,
  edge: DiagramState['edges'][number],
): ReadonlySet<string> => {
  const groupById = new Map(state.groups.map((group) => [group.id, group]));
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  const allowed = new Set<string>();

  const addGroupAncestry = (groupId: string | undefined): void => {
    let cursor = groupId;
    while (cursor) {
      if (allowed.has(cursor)) break;
      allowed.add(cursor);
      cursor = groupById.get(cursor)?.parentId;
    }
  };

  const addEndpointAncestry = (endpointId: string): void => {
    if (groupById.has(endpointId)) {
      addGroupAncestry(endpointId);
      return;
    }
    addGroupAncestry(nodeById.get(endpointId)?.groupId);
  };

  addEndpointAncestry(edge.fromId);
  addEndpointAncestry(edge.toId);
  return allowed;
};

function buildSceneCfOverview(): ReactElement {
  return (
    <Scene id="bfc-cf-overview">
      <Diagram id="cf-overview" x={0} y={0} w={1} h={0.60} tilt={-0.1} scale={1}>
        <FlowLayout direction="top-down" gap={1.05} />

        <DiagramNode
          id="cf-db"
          label=".swarm/memory.db"
          sublabel="SQLite · single file · 12 tables"
          size={[8.8, 2.5]}
          color="#1a2030"
          glow={{ intensity: 0.12 }}
        />

        <DiagramGroup id="cf-categories" variant="container">
          <GridLayout columns={2} spacing={[1.9, 1.1]} />

          <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · >=2 acceptors" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>
        </DiagramGroup>

        <DiagramEdge from="cf-db" to="cf-core" routing="flow" arrowEnd="none" color="#3a5070" flow="forward" />
        <DiagramEdge from="cf-db" to="cf-coord" routing="flow" arrowEnd="none" color="#3a5070" flow="forward" />
        <DiagramEdge from="cf-db" to="cf-intel" routing="flow" arrowEnd="none" color="#3a5070" flow="forward" />
        <DiagramEdge from="cf-db" to="cf-recov" routing="flow" arrowEnd="none" color="#3a5070" flow="forward" />
      </Diagram>
    </Scene>
  );
}

async function compileCfOverview(): Promise<DiagramState> {
  const plugin = diagramPlugin({ diagrams: ['cf-overview'] });
  plugin.registerHandlers();
  const sceneCfOverview = buildSceneCfOverview();

  const registry = new WidgetRegistry();
  const track = compileSceneTrack({
    scenes: [{ id: 'cf-overview-scene', getFrame: () => sceneCfOverview as ReactElement }],
    widgetRegistry: registry,
    blockSize: 2,
  });

  return track.ticks[0]?.state.widgets['cf-overview'] as DiagramState;
}

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
});

describe('sceneCfOverview routing', () => {
  it('routes the top containers out of the source to the left and right', async () => {
    const state = await compileCfOverview();
    const edgeById = new Map(state.edges.map((edge) => [edge.id, edge]));
    const upperLeft = edgeById.get('cf-db-cf-core-0');
    const upperRight = edgeById.get('cf-db-cf-coord-1');
    const lowerLeft = edgeById.get('cf-db-cf-intel-2');
    const lowerRight = edgeById.get('cf-db-cf-recov-3');

    expect(upperLeft, 'missing edge cf-db-cf-core-0').toBeDefined();
    expect(upperRight, 'missing edge cf-db-cf-coord-1').toBeDefined();
    expect(lowerLeft, 'missing edge cf-db-cf-intel-2').toBeDefined();
    expect(lowerRight, 'missing edge cf-db-cf-recov-3').toBeDefined();

    expect(upperLeft!.path.startTangent[0]).toBeLessThan(-0.95);
    expect(upperRight!.path.startTangent[0]).toBeGreaterThan(0.95);
    expect(lowerLeft!.path.startTangent).toEqual([0, 1, 0]);
    expect(lowerRight!.path.startTangent).toEqual([0, 1, 0]);

    state.edges.forEach((edge) => {
      edge.controlPoints.forEach((point) => {
        expect(point[0]).toBeGreaterThanOrEqual(-0.01);
        expect(point[0]).toBeLessThanOrEqual(1.01);
        expect(point[1]).toBeGreaterThanOrEqual(-0.01);
        expect(point[1]).toBeLessThanOrEqual(1.01);
      });
    });
  });

  it('does not route overview edges through group or node interiors', async () => {
    const state = await compileCfOverview();
    const nodeRects = state.nodes.map((node) => ({
      id: node.id,
      rect: nodeRect(node),
    }));
    const groupRects = state.groups
      .filter((group) => group.variant !== 'container')
      .map((group) => ({
        id: group.id,
        rect: groupRect(group),
      }));

    for (const edge of state.edges) {
      const interiorSamples = sampleEdgePath(edge).slice(1, -1);
      const allowedGroupIds = collectAllowedGroupIdsForEdge(state, edge);

      for (const sample of interiorSamples) {
        for (const group of groupRects) {
          if (allowedGroupIds.has(group.id)) {
            continue;
          }
          expect(
            pointInsideRect(sample, group.rect),
            `edge ${edge.id} crosses into group ${group.id} at (${sample[0].toFixed(4)}, ${sample[1].toFixed(4)})`,
          ).toBe(false);
        }

        for (const node of nodeRects) {
          if (node.id === edge.fromId || node.id === edge.toId) {
            continue;
          }
          expect(
            pointInsideRect(sample, node.rect),
            `edge ${edge.id} crosses into node ${node.id} at (${sample[0].toFixed(4)}, ${sample[1].toFixed(4)})`,
          ).toBe(false);
        }
      }
    }
  });
});
