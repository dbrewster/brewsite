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
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDebateRounds: JSX.Element = (
  <Scene key="bfmu-debate" id="bfmu-debate">
    <ProgressManager scrollUnits={3000} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-deb-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-deb-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-deb-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 26]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <Diagram id="deb-diagram" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale*.8} theme={brewflowTheme}>
        <FlowLayout direction="top-down" gap={2} />
        <DiagramEnter fade />

        <DiagramNode
          id="deb-r0"
          label="Round 0 — Initial Positions"
          sublabel="5 experts · parallel · no coordination · full CoT analysis"
          shape="rectangle"
          size={[10, 2.8]}
          color="#141830"
        />
        <DiagramNode
          id="deb-mod1"
          label="Moderator Debate Brief"
          sublabel="pre-converged → set aside · contested claims → targeted questions · unification question"
          shape="rectangle"
          size={[10, 2.8]}
          color="#141e35"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="deb-r1"
          label="Round 1 — Rebuttal"
          sublabel="MAINTAINED · UPDATED · CHALLENGED · ACCEPTED · WITHDRAWN"
          shape="rectangle"
          size={[10, 2.8]}
          color="#141830"
        />
        <DiagramNode
          id="deb-check"
          label="Convergence Check"
          sublabel="converged? refined? stalemate? another round needed?"
          shape="rectangle"
          size={[10, 2.4]}
          color="#131830"
        />
        <DiagramNode
          id="deb-r2"
          label="Round 2 (if warranted)"
          sublabel="remaining contested claims only · final positions"
          shape="rectangle"
          size={[10, 2.4]}
          color="#141830"
        />
        <DiagramNode
          id="deb-final"
          label="Final Moderator Pass"
          sublabel="MemoryProposalSet · confidence from convergence path · full reasoning chain as provenance"
          shape="rectangle"
          size={[10, 2.8]}
          color="#151e38"
          glow={{ intensity: 0.15 }}
        />

        <DiagramEdge from="deb-r0" to="deb-mod1" flow="forward" color="#5070b0" />
        <DiagramEdge from="deb-mod1" to="deb-r1" flow="forward" color="#5070b0" />
        <DiagramEdge from="deb-r1" to="deb-check" flow="forward" color="#5070b0" />
        <DiagramEdge from="deb-check" to="deb-r2" flow="forward" color="#5070b0" />
        <DiagramEdge from="deb-r2" to="deb-final" flow="forward" color="#5070b0" />
    </Diagram>

    <TextBox id="debate-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE DEBATE STRUCTURE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Why argue, not just extract?</div>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6, margin: 0 }}>
              A single LLM will rarely challenge its own conclusions. Debate forces reconsideration:
              the Security Expert sees a credential leak; the Process Expert sees a valid workflow;
              the Constraint Expert checks whether either claim contradicts an existing rule. Contested
              claims become explicit — the confidence score falls, not silently remains high.
            </p>
            <p style={{ fontSize: '15px', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.6, margin: '12px 0 0' }}>
              Early convergence is a feature: if all 5 experts independently propose the same claim
              in Round 0, it's pre-converged and set aside. Only contested claims consume Round 1 and 2.
            </p>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Round 1 rebuttal categories</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { cat: 'MAINTAINED', desc: 'I\'ve reviewed the challenges — my position stands unchanged' },
                { cat: 'UPDATED', desc: 'The debate revealed a nuance I missed — revised formulation follows' },
                { cat: 'CHALLENGED', desc: 'I believe this other expert\'s claim contradicts mine — here\'s why' },
                { cat: 'ACCEPTED', desc: 'The other expert\'s argument is stronger — I withdraw my version' },
                { cat: 'WITHDRAWN', desc: 'The evidence doesn\'t support this claim at this scope — retracting' },
              ].map(({ cat, desc }) => (
                <div key={cat}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.8)' }}>{cat}</span>
                  <span style={{ fontSize: '14px', color: 'rgba(180, 200, 240, 0.6)', marginLeft: 8 }}>{desc}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(160, 180, 220, 0.55)', lineHeight: 1.6, margin: '12px 0 0', fontStyle: 'italic' }}>
              The moderator's unification question: "If all your individual claims are true, what single
              principle best captures what happened?" This resolves complementary-not-contradictory splits.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
