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
  WheelMap
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneConvergence: JSX.Element = (
  <Scene key="bfmu-convergence" id="bfmu-convergence">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-conv-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-conv-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-conv-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 4, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-conv-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="conv-diagram" pivot="center">
        <ManualLayout />
        <DiagramEnter fade scaleFrom={0.85} />

        <DiagramNode
          id="conv-pre"
          label="Pre-converged"
          sublabel="independently proposed · 0.92 · strongest signal"
          shape="rectangle"
          size={[6.5, 2.4]}
          position={[-14, 0, 0]}
          color="#0f2015"
          glow={{ intensity: 0.15 }}
        />
        <DiagramNode
          id="conv-all"
          label="Debate convergence"
          sublabel="all experts agree after challenge · 0.88"
          shape="rectangle"
          size={[6.5, 2.4]}
          position={[-7, 0, 0]}
          color="#101e20"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="conv-ref"
          label="Refined convergence"
          sublabel="debate produced better formulation · 0.85"
          shape="rectangle"
          size={[6.5, 2.4]}
          position={[0, 0, 0]}
          color="#10201a"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="conv-maj"
          label="Supermajority 4/5"
          sublabel="1 dissent captured as exception · 0.75"
          shape="rectangle"
          size={[6.5, 2.4]}
          position={[7, 0, 0]}
          color="#141825"
        />
        <DiagramNode
          id="conv-dis"
          label="Disputed · stalemate"
          sublabel="human review · 0.00 · full transcript preserved"
          shape="rectangle"
          size={[6.5, 2.4]}
          position={[14, 0, 0]}
          color="#200f0f"
        />
      </Diagram>
    </DiagramCanvas>

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
        CONVERGENCE TYPES + CONFIDENCE
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {['Type', 'Definition', 'Score', 'Stage 6 action'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: '6px 12px 10px 0',
                  color: 'rgba(100, 140, 220, 0.7)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.67rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  fontWeight: 400,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Pre-converged', def: 'All 5 experts independently proposed the same claim in Round 0', score: '0.92', action: 'Accept — strongest independent signal' },
              { type: 'Debate convergence', def: 'All experts agree after Round 1 challenge', score: '0.88', action: 'Accept — pressure-tested agreement' },
              { type: 'Refined convergence', def: 'Debate improved the formulation; all now agree on new version', score: '0.85', action: 'Accept — debate added value' },
              { type: 'Supermajority 4/5', def: '4 experts agree; 1 dissents; dissent captured as exception', score: '0.75', action: 'Accept with caveat — exception documented' },
              { type: 'Disputed / stalemate', def: 'No convergence after Round 2; irreconcilable positions', score: '0.00', action: 'Human review queue — full transcript preserved' },
            ].map(({ type, def, score, action }) => (
              <tr key={type} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px 10px 0', color: '#c8d8f0', fontWeight: 500, whiteSpace: 'nowrap' }}>{type}</td>
                <td style={{ padding: '10px 12px 10px 0', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.5 }}>{def}</td>
                <td style={{ padding: '10px 12px 10px 0', color: score === '0.00' ? '#e87a7a' : '#7ac88a', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{score}</td>
                <td style={{ padding: '10px 0 10px 0', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.5 }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'rgba(160, 180, 220, 0.55)', lineHeight: 1.6, margin: '16px 0 0', fontStyle: 'italic' }}>
        Confidence scores from debate convergence combine with existing evidence signals in Stage 6 (decide):
        existing Neocortex coverage, cross-user corroboration count, and time-decay of existing items all
        factor into whether a proposal is accepted, queued for review, or rejected.
      </p>
    </div>
  </Scene>
);
