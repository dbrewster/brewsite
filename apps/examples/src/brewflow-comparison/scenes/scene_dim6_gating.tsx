import type {JSX} from 'react';
import {
    Action,
    Ambient,
    Background,
    Camera,
    Directional,
    InputController,
    KeyMap,
    Lighting,
    PointerMap,
    ProgressManager,
    Scene,
    WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDim6Gating: JSX.Element = (
  <Scene key="bfc-dim6-gate" id="bfc-dim6-gate">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />

    <Camera mode="world" position={[0, 4, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-gate-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-gate-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-gate-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-gate-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="gate-diagram" pivot="center">
        <ManualLayout />

        {/* Left — claude-flow consensus votes */}
        <DiagramNode id="gate-cf-a1" label="Agent vote: accept" size={[5.5, 2.2]} position={[-8, 3, 0]} color="#1a1520" />
        <DiagramNode id="gate-cf-a2" label="Agent vote: accept" size={[5.5, 2.2]} position={[-8, 0, 0]} color="#1a1520" />
        <DiagramNode id="gate-cf-q" label="Quorum ≥2 → proceed" sublabel="LLM agreement · can all be wrong" size={[5.5, 2.4]} position={[-8, -3.5, 0]} color="#1a1020" />

        <DiagramEdge from="gate-cf-a1" to="gate-cf-q" flow="forward" color="#5050a0" />
        <DiagramEdge from="gate-cf-a2" to="gate-cf-q" flow="forward" color="#5050a0" />

        {/* Right — BrewFlow evidence gates */}
        <DiagramNode id="gate-bf-tests" label="Automated tests" sublabel="pass/fail · coverage · regressions" size={[5.5, 2.2]} position={[8, 5, 0]} color="#141830" />
        <DiagramNode id="gate-bf-checks" label="Reconciliation checks" sublabel="expected vs actual · invariants" size={[5.5, 2.2]} position={[8, 2, 0]} color="#141830" />
        <DiagramNode id="gate-bf-sandbox" label="Sandbox execution" sublabel="safe environment replay" size={[5.5, 2.2]} position={[8, -1, 0]} color="#141830" />
        <DiagramNode id="gate-bf-human" label="Human approval" sublabel="high-risk · ambiguous decisions" size={[5.5, 2.2]} position={[8, -4, 0]} color="#141830" />
        <DiagramNode id="gate-bf-gate" label="Evidence gate" sublabel="proof required · not agreement" size={[5.5, 2.8]} position={[8, -7, 0]} color="#141e35" glow={{ intensity: 0.15 }} />

        <DiagramEdge from="gate-bf-tests" to="gate-bf-gate" flow="forward" color="#5070b0" />
        <DiagramEdge from="gate-bf-checks" to="gate-bf-gate" flow="forward" color="#5070b0" />
        <DiagramEdge from="gate-bf-sandbox" to="gate-bf-gate" flow="forward" color="#5070b0" />
        <DiagramEdge from="gate-bf-human" to="gate-bf-gate" flow="forward" color="#5070b0" />
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
      maxHeight: '55vh',
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
        DIMENSION 6: GATING AND EVIDENCE
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            claude-flow: did enough agents agree?
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            claude-flow's consensus_state table implements quorum voting — a decision
            proceeds when ≥2 acceptors agree. This is a reasonable coordination primitive
            for distributed task assignment and conflict resolution. For verifying whether
            a proposed action is correct, it has a fundamental limitation: three LLMs can
            all be wrong in exactly the same direction. Consensus measures agreement, not
            correctness.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            BrewFlow: is there proof?
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            BrewFlow's evidence gates require proof, not agreement. Automated tests must
            pass. Reconciliation checks must confirm expected vs actual invariants. Sandbox
            execution must succeed in a safe environment. Human approval is required for
            high-risk or ambiguous decisions. Only when all applicable gates clear does
            the evidence gate open.
          </p>
          <p style={{ fontSize: '0.89rem', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
            The practical implication: BrewFlow gates are expensive and slow compared to
            quorum voting. For bounded tasks where speed matters more than correctness
            guarantees, claude-flow's consensus model is appropriate. For long workstreams
            where a wrong decision compounds over many sessions, evidence gates are worth
            the cost.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
