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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneExpertRoles: JSX.Element = (
  <Scene key="bfmu-experts" id="bfmu-experts">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-exp-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-exp-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-exp-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 24]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-exp-canvas" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="exp-diagram">
        <ManualLayout />
        <DiagramEnter fade />

        {/* Hub — the episode */}
        <DiagramNode
          id="exp-episode"
          label="Episode"
          sublabel="raw event log · tool calls · outcomes · errors"
          shape="rectangle"
          size={[0.185, 0.182]}
          position={[0.364, 0.630, 0]}
          color="#141830"
          glow={{ intensity: 0.12 }}
        />

        {/* 5 experts */}
        <DiagramNode
          id="exp-sec"
          label="Security Expert"
          sublabel="credentials · secrets · access control · injection · PII"
          shape="rectangle"
          size={[0.172, 0.156]}
          position={[0.126, 0.175, 0]}
          color="#101828"
        />
        <DiagramNode
          id="exp-rel"
          label="Reliability Expert"
          sublabel="failure modes · race conditions · retry · cascading failures"
          shape="rectangle"
          size={[0.172, 0.156]}
          position={[0.126, 0.500, 0]}
          color="#101828"
        />
        <DiagramNode
          id="exp-proc"
          label="Process Expert"
          sublabel="multi-step sequences · ordering dependencies · preconditions"
          shape="rectangle"
          size={[0.172, 0.156]}
          position={[0.126, 0.825, 0]}
          color="#101828"
        />
        <DiagramNode
          id="exp-const"
          label="Constraint Expert"
          sublabel="hard rules · invariants · never-do-X patterns"
          shape="rectangle"
          size={[0.172, 0.156]}
          position={[0.603, 0.305, 0]}
          color="#101828"
        />
        <DiagramNode
          id="exp-dis"
          label="Disambiguation Expert"
          sublabel="ambiguous terms · naming collisions · contextual decisions"
          shape="rectangle"
          size={[0.172, 0.156]}
          position={[0.603, 0.630, 0]}
          color="#101828"
        />

        {/* CoT steps */}
        <DiagramNode
          id="cot-1"
          label="1. Observe"
          sublabel="what literally happened"
          shape="rectangle"
          size={[0.132, 0.130]}
          position={[0.894, 0.305, 0]}
          color="#131828"
        />
        <DiagramNode
          id="cot-2"
          label="2. Interpret"
          sublabel="what it means for future"
          shape="rectangle"
          size={[0.132, 0.130]}
          position={[0.894, 0.500, 0]}
          color="#131828"
        />

        {/* Experts read the episode — arrowStart="open" means arrow at source end */}
        <DiagramEdge from="exp-sec" to="exp-episode" arrowEnd="none" arrowStart="open" color="#4060a0" />
        <DiagramEdge from="exp-rel" to="exp-episode" arrowEnd="none" arrowStart="open" color="#4060a0" />
        <DiagramEdge from="exp-proc" to="exp-episode" arrowEnd="none" arrowStart="open" color="#4060a0" />
        <DiagramEdge from="exp-const" to="exp-episode" arrowEnd="none" arrowStart="open" color="#4060a0" />
        <DiagramEdge from="exp-dis" to="exp-episode" arrowEnd="none" arrowStart="open" color="#4060a0" />

        <DiagramEdge from="cot-1" to="cot-2" color="#3050a0" style="dashed" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="experts-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE FIVE EXPERT ROLES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Why single-LLM extraction fails</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Confidentiality blindness — misses security implications without specialist focus',
                'Recency bias — over-weights the last tool call; misses patterns across a session',
                'False generalization — promotes one successful trick to universal rule prematurely',
                'Terminological drift — ambiguous variable names produce contradictory memory cards',
              ].map((item, i) => (
                <li key={i} style={{ fontSize: '15px', color: 'rgba(200, 180, 180, 0.8)', lineHeight: 1.6 }}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Chain of Thought — 5 steps per expert</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { step: '1. Observe', desc: 'What literally happened — tool calls, inputs, outputs, errors' },
                { step: '2. Interpret', desc: 'What it means — success/failure cause, implications for future work' },
                { step: '3. Generalize', desc: 'What principle this suggests — constrained to the expert\'s domain' },
                { step: '4. Challenge', desc: 'Internal adversarial pressure — where does this principle break?' },
                { step: '5. Propose', desc: 'A structured MemoryProposal — title, body, confidence, scope, type' },
              ].map(({ step, desc }) => (
                <div key={step}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)' }}>{step}</div>
                  <div style={{ fontSize: '14px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
