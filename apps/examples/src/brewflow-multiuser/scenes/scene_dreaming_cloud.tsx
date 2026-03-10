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
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDreamingCloud: JSX.Element = (
  <Scene key="bfmu-dreaming" id="bfmu-dreaming">
    <ProgressManager scrollUnits={3000} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-dream-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-dream-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-dream-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 30]} target={[0, 0, 0]} fov={54} />
    <Background color="#080b14" />

    <Diagram id="dream-diagram" theme={brewflowTheme}>
        <ManualLayout />
        <DiagramEnter fade />

        {/* Three concurrent dreamers */}
        <DiagramNode
          id="dream-a"
          label="Dreamer-A"
          sublabel="user A episodes only · Stages 1-4 · concurrent"
          shape="rectangle"
          size={[0.222, 0.118]}
          position={[0.167, 0.133, 0]}
          color="#141830"
        />
        <DiagramNode
          id="dream-b"
          label="Dreamer-B"
          sublabel="user B episodes only · Stages 1-4 · concurrent"
          shape="rectangle"
          size={[0.222, 0.118]}
          position={[0.500, 0.133, 0]}
          color="#141830"
        />
        <DiagramNode
          id="dream-c"
          label="Dreamer-C"
          sublabel="user C episodes only · Stages 1-4 · concurrent"
          shape="rectangle"
          size={[0.222, 0.118]}
          position={[0.833, 0.133, 0]}
          color="#141830"
        />

        {/* Shared promotion queue */}
        <DiagramNode
          id="promo-q"
          label="Promotion Queue"
          sublabel="shared · ordered · serialized per scope"
          shape="rectangle"
          size={[0.370, 0.138]}
          position={[0.500, 0.517, 0]}
          color="#141e35"
          glow={{ intensity: 0.12 }}
        />

        {/* Promotion worker */}
        <DiagramNode
          id="promo-worker"
          label="Promotion Worker"
          sublabel="Stage 5: validate · Stage 6: decide · Stage 7: publish"
          shape="rectangle"
          size={[0.296, 0.138]}
          position={[0.500, 0.626, 0]}
          color="#151e38"
          glow={{ intensity: 0.15 }}
        />

        {/* Outputs */}
        <DiagramNode
          id="out-user-a"
          label="User-A Neocortex"
          shape="rectangle"
          size={[0.185, 0.108]}
          position={[0.204, 0.872, 0]}
          color="#121828"
        />
        <DiagramNode
          id="out-project"
          label="Project Neocortex"
          sublabel="shared · serialized"
          shape="rectangle"
          size={[0.185, 0.108]}
          position={[0.500, 0.872, 0]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="out-user-b"
          label="User-B Neocortex"
          shape="rectangle"
          size={[0.185, 0.108]}
          position={[0.796, 0.872, 0]}
          color="#121828"
        />

        {/* Dreamer → queue */}
        <DiagramEdge from="dream-a" to="promo-q" flow="forward" color="#5070b0" />
        <DiagramEdge from="dream-b" to="promo-q" flow="forward" color="#5070b0" />
        <DiagramEdge from="dream-c" to="promo-q" flow="forward" color="#5070b0" />

        {/* Queue → worker */}
        <DiagramEdge from="promo-q" to="promo-worker" flow="forward" color="#6080c0" />

        {/* Worker → outputs */}
        <DiagramEdge from="promo-worker" to="out-user-a" color="#5070b0" />
        <DiagramEdge from="promo-worker" to="out-project" color="#5070b0" />
        <DiagramEdge from="promo-worker" to="out-user-b" color="#5070b0" />
    </Diagram>

    <TextBox id="dreaming-prose" x={0} y={0.58} w={1} h={0.42}>
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
          DREAMING AT SCALE
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          Concurrent extraction, serialized promotion.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 6 }}>Phase A — Slice-based (concurrent)</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Stages 1–4 run independently per user. Each dreamer processes only its own episodic
              slice — the events belonging to one user's sessions. No coordination needed. User A's
              dreamer and User B's dreamer run in parallel, producing independent
              <code style={{ fontSize: '14px', color: 'rgba(120,160,240,0.8)' }}> MemoryProposalSet</code> objects.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 6 }}>Phase B — Queue-based (serialized)</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Stages 5–7 run through a shared promotion queue. One worker processes proposals in
              order, validating against existing Neocortex content, resolving conflicts, and writing
              to the appropriate plane. Serialization ensures no two proposals race to modify the
              same Neocortex document simultaneously.
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
