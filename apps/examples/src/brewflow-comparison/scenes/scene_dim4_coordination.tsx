import type {JSX} from 'react';
import {
    Action,
    Background,
    Camera,
    InputController,
    KeyMap,
    PointerMap,
    ProgressManager,
    Scene,
    TextBox,
    WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramNode, GridLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDim4Coordination: JSX.Element = (
  <Scene key="bfc-dim4-coord" id="bfc-dim4-coord">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Diagram id="coord-diagram" x={0} y={0} w={1} h={0.56} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
        <GridLayout columns={2} spacing={[3, 2]} />

        {/* Left — claude-flow shared_state */}
        <DiagramNode id="coord-cf-a1" label="Agent A" size={[5.5, 2.4]} color="#1a1520" />
        <DiagramNode id="coord-cf-bb" label="shared_state table" sublabel="versioned key-value · what · who · when" size={[5.5, 2.4]} color="#1a1020" />
        <DiagramNode id="coord-cf-a2" label="Agent B" size={[5.5, 2.4]} color="#1a1520" />

        <DiagramEdge from="coord-cf-a1" to="coord-cf-bb" label="writes value" color="#5050a0" />
        <DiagramEdge from="coord-cf-bb" to="coord-cf-a2" label="reads value" color="#5050a0" />

        {/* Right — BrewFlow synaptic_event */}
        <DiagramNode id="coord-bf-a1" label="Agent A" size={[5.5, 2.4]} color="#141830" glow={{ intensity: 0.1 }} />
        <DiagramNode id="coord-bf-ep" label="synaptic_event" sublabel="typed · globalEventSeq · full lineage · replayable" size={[5.5, 2.4]} color="#141830" glow={{ intensity: 0.14 }} />
        <DiagramNode id="coord-bf-a2" label="Agent B" size={[5.5, 2.4]} color="#141830" glow={{ intensity: 0.1 }} />

        <DiagramEdge from="coord-bf-a1" to="coord-bf-ep" label="emits event" flow="forward" color="#5070b0" />
        <DiagramEdge from="coord-bf-ep" to="coord-bf-a2" label="causally traceable" flow="forward" color="#5070b0" />
    </Diagram>

    <TextBox id="dim4-prose" x={0} y={0.56} w={1} h={0.44}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          DIMENSION 4: CROSS-AGENT COORDINATION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              claude-flow: structural blackboard
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              The shared_state table is claude-flow's primary coordination mechanism. Agents
              write versioned key-value pairs: what the value is, who wrote it, when. This
              answers structural questions well — what did agent A write? What is the current
              value of key X? The versioning means you can see the history of a value.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(160, 180, 220, 0.6)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              What it cannot answer: why did agent A write that value? What led to this
              decision? What caused agent B's subsequent action?
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              BrewFlow: causal event chain
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              BrewFlow records coordination events as synaptic_event typed records in the
              EpisodicStore. Each event carries its globalEventSeq, full lineage references,
              and enough typed schema to reconstruct the causal chain. When agent B makes a
              decision because of something agent A communicated, both the communication and
              the decision are causally linked in the event stream.
            </p>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              The practical difference shows up in incident investigation. With BrewFlow you
              can trace: agent B made this decision → because of this synaptic_event → which
              agent A emitted → in this context → because of these prior events. With
              claude-flow you see agent A wrote value X and agent B later read value X, but
              the causal connection between B's action and the specific context that prompted A
              requires manual reconstruction.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
