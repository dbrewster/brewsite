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
  WheelMap
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneFractal: JSX.Element = (
  <Scene key="bfmu-fractal" id="bfmu-fractal">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-frac-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-frac-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-frac-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-frac-canvas" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="frac-diagram">
        <FlowLayout direction="top-down" gap={2} />
        <DiagramEnter fade />

        <DiagramNode
          id="sc0"
          label="Scale 0 — Within one expert's CoT"
          sublabel="expert argues with themselves · Step 4 (CHALLENGE) = internal adversarial pressure"
          shape="rectangle"
          size={[12, 2.4]}
          color="#141828"
        />
        <DiagramNode
          id="sc1"
          label="Scale 1 — Expert debate round"
          sublabel="5 specialists argue across rounds · tested pressured agreement · not counting"
          shape="rectangle"
          size={[12, 2.4]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="sc2"
          label="Scale 2 — Across sessions (per user)"
          sublabel="multiple sessions cluster into stronger proposals · seen once = hypothesis · seen 5× = candidate"
          shape="rectangle"
          size={[12, 2.4]}
          color="#141830"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="sc3"
          label="Scale 3 — Across users (project scope)"
          sublabel="multiple independent users converge · cross-user corroboration → project-Neocortex"
          shape="rectangle"
          size={[12, 2.4]}
          color="#141e35"
          glow={{ intensity: 0.14 }}
        />
        <DiagramNode
          id="sc4"
          label="Scale 4 — Across time (verified use)"
          sublabel="Neocortex items accumulate confirmations or contradictions · repeated use strengthens · failures demote"
          shape="rectangle"
          size={[12, 2.4]}
          color="#151e38"
          glow={{ intensity: 0.16 }}
        />

        <DiagramEdge from="sc0" to="sc1" flow="forward" color="#5070b0" />
        <DiagramEdge from="sc1" to="sc2" flow="forward" color="#5070b0" />
        <DiagramEdge from="sc2" to="sc3" flow="forward" color="#5070b0" />
        <DiagramEdge from="sc3" to="sc4" flow="forward" color="#5070b0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="fractal-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8,11,20,0.88)',
        backdropFilter: 'blur(16px)',
        height: '100%',
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          THE FRACTAL EVIDENCE MODEL
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          The same principle at every scale: multiple independent sources arguing until they agree.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.7, margin: 0 }}>
              At Scale 0, a single expert's internal Step 4 (CHALLENGE) asks "where does this break?"
              before proposing. At Scale 1, five specialists argue the same episode from different lenses.
              At Scale 2, the same expert's observations across multiple sessions cluster into stronger
              evidence. At Scale 3, independent users converging on the same conclusion crosses the
              project-scope threshold. At Scale 4, real-world use over time either confirms or demotes.
            </p>
          </div>
          <div>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.7, margin: 0 }}>
              The debate model adds Scale 1 rigor. Without it, Scale 2 inherits unexamined assumptions
              from a single LLM pass — a confident wrong conclusion clusters just as readily as a confident
              right one. With Scale 1, only claims that survived inter-expert challenge reach Scale 2
              accumulation. The evidence pyramid is stronger at every level above it.
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(160, 180, 220, 0.55)', lineHeight: 1.6, margin: '12px 0 0', fontStyle: 'italic' }}>
              Note: none of these scales replace each other. A claim that is pre-converged at Scale 1
              still needs Scale 2 corroboration before reaching project scope. The scales are cumulative,
              not substitutable.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
