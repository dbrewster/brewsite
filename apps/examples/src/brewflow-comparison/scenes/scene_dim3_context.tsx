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

export const sceneDim3Context: JSX.Element = (
  <Scene key="bfc-dim3-context" id="bfc-dim3-context">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />

    <Diagram id="ctx-diagram" x={0} y={0} w={1} h={0.56} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
        <GridLayout columns={2} spacing={[3, 2]} />

        {/* Left — claude-flow */}
        <DiagramNode id="ctx-cf-human" label="Human writes system prompt" sublabel="manual template · static" size={[7, 2.4]} color="#1a1520" />
        <DiagramNode id="ctx-cf-queen" label="Queen assembles task description" sublabel="knows what context to include (or doesn't)" size={[7, 2.4]} color="#1a1520" />
        <DiagramNode id="ctx-cf-agent" label="Agent" sublabel="session 1 = session 100" size={[7, 2.4]} color="#1a1520" />

        <DiagramEdge from="ctx-cf-human" to="ctx-cf-queen" flow="forward" color="#5050a0" />
        <DiagramEdge from="ctx-cf-queen" to="ctx-cf-agent" flow="forward" color="#5050a0" />

        {/* Right — BrewFlow InjectorCortex */}
        <DiagramNode id="ctx-bf-scope" label="scope + intent + budget" sublabel="input to InjectorCortex" size={[7, 2.4]} color="#121830" />
        <DiagramNode id="ctx-bf-filter" label="Hard filters" sublabel="scope · status:verified · validity window" size={[7, 2.2]} color="#121830" />
        <DiagramNode id="ctx-bf-recall" label="Hybrid recall" sublabel="lexical FTS + semantic embedding" size={[7, 2.2]} color="#131930" />
        <DiagramNode id="ctx-bf-rank" label="Rerank + adjacency" sublabel="anchor overlap · provenance · neighboring constraints" size={[7, 2.2]} color="#141a35" />
        <DiagramNode id="ctx-bf-pack" label="Bounded packet" sublabel="constraints→disambiguation→procedures→pitfalls · reproducible" size={[7, 2.4]} color="#151e38" glow={{ intensity: 0.12 }} />

        <DiagramEdge from="ctx-bf-scope" to="ctx-bf-filter" flow="forward" color="#5070b0" />
        <DiagramEdge from="ctx-bf-filter" to="ctx-bf-recall" flow="forward" color="#5070b0" />
        <DiagramEdge from="ctx-bf-recall" to="ctx-bf-rank" flow="forward" color="#5070b0" />
        <DiagramEdge from="ctx-bf-rank" to="ctx-bf-pack" flow="forward" color="#5070b0" />
    </Diagram>

    <TextBox id="dim3-prose" x={0} y={0.56} w={1} h={0.44}>
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
          DIMENSION 3: CONTEXT ASSEMBLY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              claude-flow: manual and static
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              Context assembly in claude-flow is a human responsibility. Operators write system
              prompts as templates. The Queen agent assembles task descriptions based on its
              own understanding of what context an agent needs. Session 1 and session 100
              receive the same quality of context — there is no mechanism for the system to
              improve context assembly based on past experience.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              BrewFlow: automated and improving
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              InjectorCortex assembles context programmatically. Given scope, intent, and a
              token budget, it runs hard filters (scope match, status:verified, validity
              window), hybrid recall (lexical + semantic), reranking by provenance and
              adjacency, and produces a bounded, ordered packet. The packet is deterministic
              and reproducible — the same inputs produce the same output.
            </p>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              The key compounding effect: session 50 gets a meaningfully better context packet
              than session 1, because the Neocortex has more verified cards with higher
              provenance scores. The context assembly algorithm doesn't change — the input
              data improves.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
