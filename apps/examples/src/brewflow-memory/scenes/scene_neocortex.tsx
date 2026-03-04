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
  WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, FlowLayout, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

// Both sub-diagrams placed in one canvas using manual positions.
// neo-types nodes: y=0..5 area
// neo-lifecycle nodes: y=-12 area (simulating a -10 diagram offset from the spec)
export const sceneNeocortex: JSX.Element = (
  <Scene key="bfm-neocortex" id="bfm-neocortex">
    <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 6, 28]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfm-neo-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfm-neo-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfm-neo-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfm-neo-canvas" position={[0, config.diagramTop+2, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      {/* Diagram 1: 6 card types around a center node */}
      <Diagram id="neo-types" pivot="center" position={[0, -5, 0]}>
        <HierarchicalLayout direction="left-right" spacing={[2, 2]} />

        <DiagramNode id="neo-core" label="Neocortex" sublabel="typed · versioned · provenance-backed" size={[6, 2.8]} color="#141830" glow={{ intensity: 0.15 }} />
        <DiagramNode id="card-procedure" label="procedure" sublabel="executable multi-step plans" size={[5.5, 2.4]} color="#101828" />
        <DiagramNode id="card-constraint" label="constraint" sublabel="hard rules · invariants" size={[5.5, 2.4]} color="#101828" />
        <DiagramNode id="card-disambiguation" label="disambiguation" sublabel="ambiguous terms · decision rules" size={[5.5, 2.4]} color="#101828" />
        <DiagramNode id="card-checklist" label="checklist" sublabel="validation before ship" size={[5.5, 2.4]} color="#101828" />
        <DiagramNode id="card-pitfall" label="pitfall" sublabel="documented failure modes · corrections" size={[5.5, 2.4]} color="#101828" />
        <DiagramNode id="card-concept" label="concept" sublabel="canonical domain definitions" size={[5.5, 2.4]} color="#101828" />

        <DiagramEdge from="neo-core" to="card-procedure" color="#4060a0" />
        <DiagramEdge from="neo-core" to="card-constraint" color="#4060a0" />
        <DiagramEdge from="neo-core" to="card-disambiguation" color="#4060a0" />
        <DiagramEdge from="neo-core" to="card-checklist" color="#4060a0" />
        <DiagramEdge from="neo-core" to="card-pitfall" color="#4060a0" />
        <DiagramEdge from="neo-core" to="card-concept" color="#4060a0" />
      </Diagram>

      {/* Diagram 2: Horizontal lifecycle chain, positioned below types diagram */}
      <Diagram id="neo-lifecycle" pivot="center" position={[0, 5, 0]}>
        <FlowLayout direction="left-right" gap={2} />

        <DiagramNode id="lc-candidate" label="candidate" sublabel="LLM proposed · unvalidated" size={[4.5, 2.4]} color="#1a1020" />
        <DiagramNode id="lc-reviewed" label="reviewed" sublabel="passed deterministic validators" size={[4.5, 2.4]} color="#141828" />
        <DiagramNode id="lc-verified" label="verified" sublabel="execution-validated · human approved (high-risk)" size={[4.5, 2.4]} color="#141e30" glow={{ intensity: 0.12 }} />
        <DiagramNode id="lc-deprecated" label="deprecated" sublabel="queryable for backtrace · not injected" size={[4.5, 2.4]} color="#1a1010" />
        <DiagramNode id="lc-disputed" label="disputed" sublabel="contradicting evidence · needs human resolution" size={[4.5, 2.4]} color="#1a1215" />

        <DiagramEdge from="lc-candidate" to="lc-reviewed" style="solid" flow="forward" color="#5070b0" />
        <DiagramEdge from="lc-reviewed" to="lc-verified" style="solid" flow="forward" color="#5070b0" />
        <DiagramEdge from="lc-verified" to="lc-deprecated" style="dashed" color="#4060a0" />
        <DiagramEdge from="lc-verified" to="lc-disputed" style="dashed" color="#8040a0" />
      </Diagram>
    </DiagramCanvas>

    {/* Prose panel */}
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '40px 64px 48px',
      background: 'rgba(8, 11, 20, 0.88)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      maxHeight: '50vh',
      overflowY: 'auto',
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.67rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase' as const,
        color: 'rgba(100, 140, 220, 0.7)',
        marginBottom: 16,
      }}>
        NEOCORTEX — WHAT WE KNOW
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '28px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Schematic memory
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            Neocortex stores typed memory cards — validated, versioned knowledge that survives
            across sessions. Every card carries full provenance: which episodes it was extracted
            from, which dreamer run proposed it, and who or what validated it.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            6 card types
          </h3>
          <ul style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.8, margin: 0, padding: 0, listStyle: 'none' }}>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>procedure</span> — multi-step executable plans</li>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>constraint</span> — hard rules and invariants</li>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>disambiguation</span> — term resolution</li>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>checklist</span> — pre-ship validation</li>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>pitfall</span> — documented failures</li>
            <li><span style={{ color: 'rgba(160, 180, 240, 0.5)' }}>concept</span> — canonical definitions</li>
          </ul>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Retrieval pipeline (5 stages)
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 12px' }}>
            Query → scope filter → relevance score → lifecycle filter (verified only) →
            token budget trim → ordered pack. Only "verified" cards are injected; "reviewed"
            cards are queryable but not auto-injected. Deprecated cards remain queryable
            for backtrace but never appear in context packs.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
