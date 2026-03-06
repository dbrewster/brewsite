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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneCrossUserFlow: JSX.Element = (
  <Scene key="bfmu-crossuser" id="bfmu-crossuser">
    <ProgressManager scrollUnits={3000} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-cross-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-cross-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-cross-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 26]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-cross-canvas" position={[0, 2, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="cross-diagram">
        <HierarchicalLayout direction="top-down" />
        <DiagramEnter fade />

        <DiagramNode
          id="alice-session"
          label="Alice discovers --force issue"
          sublabel="1 episode · user-scope only · confidence 0.7"
          shape="rectangle"
          size={[7, 2.4]}
          color="#1a1520"
        />
        <DiagramNode
          id="alice-neo"
          label="Alice's User-Neocortex"
          sublabel="pitfall promoted · not yet project-scope"
          shape="rectangle"
          size={[7, 2.4]}
          color="#141828"
        />
        <DiagramNode
          id="bob-session"
          label="Bob hits same issue"
          sublabel="2 independent episodes now · cluster threshold met"
          shape="rectangle"
          size={[7, 2.4]}
          color="#1a1520"
        />
        <DiagramNode
          id="promo-queue"
          label="Project promotion queue"
          sublabel="confidence 0.85 · project scope"
          shape="rectangle"
          size={[7, 2.8]}
          color="#141e35"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="project-neo"
          label="Project-Neocortex"
          sublabel="pitfall card v1 · reviewed · human approval queued"
          shape="rectangle"
          size={[7, 2.8]}
          color="#141830"
          glow={{ intensity: 0.14 }}
        />
        <DiagramNode
          id="dave-session"
          label="Dave's next session"
          sublabel="gets context pack with verified pitfall · never hits the problem"
          shape="rectangle"
          size={[7, 2.4]}
          color="#0f2030"
          glow={{ intensity: 0.1 }}
        />

        <DiagramEdge from="alice-session" to="alice-neo" flow="forward" color="#5070b0" />
        <DiagramEdge from="alice-neo" to="bob-session" label="two weeks later" flow="forward" color="#5070b0" />
        <DiagramEdge from="bob-session" to="promo-queue" flow="forward" color="#5070b0" />
        <DiagramEdge from="promo-queue" to="project-neo" flow="forward" color="#6080c0" />
        <DiagramEdge from="project-neo" to="dave-session" label="verified · injected by InjectorCortex" flow="forward" color="#5070b0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="crossuser-prose" x={0} y={0.58} w={1} h={0.42}>
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
          CROSS-USER LEARNING FLOW
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          Dave's agent never hit this problem. But it knows not to.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: "Alice's session", detail: "Alice triggers a git operation with --force and causes a problem. Her dreamer extracts a pitfall: \"git push --force on shared branches corrupts review history.\" Confidence 0.7 — one episode, user-scope only." },
                { step: "Alice's Neocortex", detail: "The pitfall is promoted to Alice's User-Neocortex. It will appear in Alice's future context packs. Not yet visible to the team." },
                { step: "Bob's session (two weeks later)", detail: "Bob independently hits the same issue. His dreamer extracts the same pitfall. Now there are 2 independent user-scope episodes — the cluster threshold for project promotion is met." },
              ].map(({ step, detail }) => (
                <div key={step}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 3 }}>{step}</div>
                  <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: 'Project promotion queue', detail: 'The promotion worker picks up both proposals, validates them against existing Project-Neocortex content, finds no conflict. Confidence now 0.85. Queued for human review.' },
                { step: 'Project-Neocortex', detail: 'After human approval: pitfall card v1 — "Never use git push --force on shared branches. Use --force-with-lease if you must override." Promoted to project scope.' },
                { step: "Dave's session", detail: "InjectorCortex includes the pitfall in Dave's context pack before his session starts. Dave's agent has the constraint in context. The mistake is never made." },
              ].map(({ step, detail }) => (
                <div key={step}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 3 }}>{step}</div>
                  <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
