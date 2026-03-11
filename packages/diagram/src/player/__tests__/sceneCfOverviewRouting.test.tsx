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
});
