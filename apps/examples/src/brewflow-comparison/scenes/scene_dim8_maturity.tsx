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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, GridLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDim8Maturity: JSX.Element = (
  <Scene key="bfc-dim8-mature" id="bfc-dim8-mature">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-mature-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-mature-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-mature-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-mature-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="mature-diagram" pivot="center">
        <GridLayout columns={2} spacing={[3, 2]} />

        {/* Left column — claude-flow maturation */}
        <DiagramNode id="mat-cf-s1" label="Session 1" sublabel="patterns: 0" size={[5.5, 2.2]} color="#1a1520" />
        <DiagramNode id="mat-cf-s20" label="Session 20" sublabel="patterns: accumulating · unvalidated" size={[5.5, 2.2]} color="#1a1520" />
        <DiagramNode id="mat-cf-s50" label="Session 50" sublabel="more patterns · same quality problem" size={[5.5, 2.2]} color="#1a1520" />
        <DiagramNode id="mat-cf-s100" label="Session 100" sublabel="flat curve · operator-maintained quality" size={[5.5, 2.2]} color="#1a1020" />

        <DiagramEdge from="mat-cf-s1" to="mat-cf-s20" color="#605050" />
        <DiagramEdge from="mat-cf-s20" to="mat-cf-s50" color="#605050" />
        <DiagramEdge from="mat-cf-s50" to="mat-cf-s100" color="#605050" />

        {/* Right column — BrewFlow maturation */}
        <DiagramNode id="mat-bf-s1" label="Sessions 1–5" sublabel="observation · EpisodicStore fills · Neocortex lean" size={[6.5, 2.2]} color="#141830" />
        <DiagramNode id="mat-bf-s20" label="Sessions 5–20" sublabel="first constraints · pitfalls · procedure drafts promoted" size={[6.5, 2.2]} color="#141830" glow={{ intensity: 0.1 }} />
        <DiagramNode id="mat-bf-s50" label="Sessions 20–50" sublabel="verified cards · richer packs · fewer clarification turns" size={[6.5, 2.2]} color="#141830" glow={{ intensity: 0.13 }} />
        <DiagramNode id="mat-bf-s100" label="Sessions 50+" sublabel="refinement · pruning deprecated · maintenance mode" size={[6.5, 2.2]} color="#141e35" glow={{ intensity: 0.16 }} />

        <DiagramEdge from="mat-bf-s1" to="mat-bf-s20" flow="forward" color="#5070b0" />
        <DiagramEdge from="mat-bf-s20" to="mat-bf-s50" flow="forward" color="#5070b0" />
        <DiagramEdge from="mat-bf-s50" to="mat-bf-s100" flow="forward" color="#5070b0" />
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
        DIMENSION 8: MATURATION
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            claude-flow: flat curve
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            claude-flow accumulates patterns across sessions, but the quality of those
            patterns depends entirely on LLM output quality and operator maintenance.
            Session 100 has more patterns than session 1, but not necessarily better ones —
            there is no structural mechanism that ensures accumulated patterns improve over
            time. Whether session 100 produces better outcomes than session 1 depends almost
            entirely on how well the human operator maintained configurations.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            BrewFlow: compounding curve
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            BrewFlow's maturation curve is structurally compounding. Sessions 1–5 fill the
            EpisodicStore with observations. Sessions 5–20 see the first validated constraints
            and pitfalls promoted to Neocortex. Sessions 20–50 build richer context packs
            that reduce clarification turns. Sessions 50+ enter maintenance mode — refining
            and pruning deprecated cards. Each phase improves the next because validated
            knowledge accumulates in a structure designed for retrieval.
          </p>
          <p style={{ fontSize: '0.89rem', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
            The investment crossover point is approximately sessions 10–20. Before that,
            claude-flow's simpler model may produce comparable results. After that,
            BrewFlow's compounding advantage becomes significant for similar tasks.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
