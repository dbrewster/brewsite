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

export const sceneConflict: JSX.Element = (
  <Scene key="bfmu-conflict" id="bfmu-conflict">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-conf-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-conf-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-conf-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 4, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-conf-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale*.8} theme={brewflowTheme}>
      <Diagram id="conf-diagram">
        <ManualLayout />
        <DiagramEnter fade />

        <DiagramNode
          id="conf-alice"
          label="Alice's proposal"
          sublabel="migration files can be modified before staging apply"
          shape="rectangle"
          size={[0.292, 0.138]}
          position={[0.208, 0.155, 0]}
          color="#1a1520"
        />
        <DiagramNode
          id="conf-existing"
          label="Existing verified constraint"
          sublabel="Never modify existing migration files · version 3 · verified"
          shape="rectangle"
          size={[0.292, 0.138]}
          position={[0.792, 0.155, 0]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="conf-detect"
          label="Conflict detected"
          sublabel="contradictory_claim · conflict record created"
          shape="rectangle"
          size={[0.292, 0.161]}
          position={[0.500, 0.385, 0]}
          color="#2a1010"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="conf-both"
          label="Both flagged: disputed"
          sublabel="context packs show both with [disputed] label · not silently one or the other"
          shape="rectangle"
          size={[0.292, 0.138]}
          position={[0.500, 0.615, 0]}
          color="#1a1015"
        />
        <DiagramNode
          id="conf-human"
          label="Human review required"
          sublabel="correction to constraint OR exception documented"
          shape="rectangle"
          size={[0.292, 0.138]}
          position={[0.500, 0.845, 0]}
          color="#141830"
        />

        <DiagramEdge from="conf-alice" to="conf-detect" flow="forward" color="#805050" />
        <DiagramEdge from="conf-existing" to="conf-detect" flow="forward" color="#805050" />
        <DiagramEdge from="conf-detect" to="conf-both" flow="forward" color="#805050" />
        <DiagramEdge from="conf-both" to="conf-human" flow="forward" color="#805050" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="conflict-prose" x={0} y={0.58} w={1} h={0.42}>
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
          CONFLICTS SURFACE, NOT MERGE
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          The system never auto-merges contradictory claims regardless of confidence scores.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Conflict record schema</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              When the promotion worker detects a contradiction, it creates a conflict record:
            </div>
            <pre style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              color: 'rgba(120, 160, 240, 0.8)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4,
              padding: '10px 12px',
              marginTop: 10,
              overflow: 'auto',
            }}>{`{
  conflictId,
  type: 'contradictory_claim',
  proposalId,          // incoming
  existingItemId,      // existing
  detectedAt,
  status: 'pending_review',
  resolution: null,
}`}</pre>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>4 resolution outcomes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { outcome: 'New proposal wins', desc: 'Existing constraint is outdated. Existing demoted; new promoted. Version history preserved.' },
                { outcome: 'Existing constraint wins', desc: 'Incoming proposal is rejected. Logged with reason. Alice notified if notification configured.' },
                { outcome: 'Exception documented', desc: 'Both are true in different contexts. New item: "Exception to constraint X under conditions Y." Both remain active.' },
                { outcome: 'Both withdrawn', desc: 'The domain is genuinely ambiguous. Both items flagged as [needs clarification]. Human writes authoritative definition.' },
              ].map(({ outcome, desc }) => (
                <div key={outcome}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 2 }}>{outcome}</div>
                  <div style={{ fontSize: '14px', color: 'rgba(180, 200, 240, 0.65)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
