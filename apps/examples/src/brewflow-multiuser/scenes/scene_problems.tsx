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
import {Diagram, DiagramCanvas, DiagramEnter, DiagramNode, GridLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneProblems: JSX.Element = (
  <Scene key="bfmu-problems" id="bfmu-problems">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-prob-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-prob-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-prob-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 4, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-prob-canvas" position={[0, 2, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="prob-diagram">
        <GridLayout columns={2} spacing={[3, 3]} />
        <DiagramEnter fade />

        <DiagramNode
          id="p1"
          label="Episodic stomping"
          sublabel="two users' event sequences collide · lineage corrupted"
          shape="rectangle"
          size={[7, 2.8]}
          color="#2a1010"
        />
        <DiagramNode
          id="p2"
          label="Session confusion"
          sublabel="concurrent overlapping sessions · wrong attribution"
          shape="rectangle"
          size={[7, 2.8]}
          color="#2a1010"
        />
        <DiagramNode
          id="p3"
          label="Dreaming conflicts"
          sublabel="two dreamers race to write Neocortex · last writer wins"
          shape="rectangle"
          size={[7, 2.8]}
          color="#2a1010"
        />
        <DiagramNode
          id="p4"
          label="Neocortex ownership"
          sublabel="who can write shared knowledge? · one bad session corrupts all"
          shape="rectangle"
          size={[7, 2.8]}
          color="#2a1010"
        />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="problems-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE NEW PROBLEMS
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          Add a second user and the entire model breaks.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e87a7a', marginBottom: 6 }}>Episodic stomping</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Each user's event log uses sequence numbers for ordering. Two users sharing one store
              write to the same sequence namespace. Events interleave, lineage pointers point at the
              wrong user's events, and the episodic record becomes unreadable.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e87a7a', marginBottom: 6 }}>Session confusion</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Two concurrent sessions have no stable identity boundary. Events captured during user A's
              session may be attributed to user B's concurrently-running session, especially during
              overlapping dreamer runs.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e87a7a', marginBottom: 6 }}>Dreaming conflicts</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Two dreamers triggered by two separate session-ends race to update the same Neocortex
              document. No locking means last writer wins. One dreamer's promotions silently overwrite
              the other's, with no record of what was lost.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#e87a7a', marginBottom: 6 }}>Neocortex ownership</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Without an ownership model, any session can write any constraint into the shared
              Neocortex. One bad session — confused agent, bad LLM output, hallucinated conclusion —
              can poison the shared knowledge that every future user relies on.
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
