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
  WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneSensitiveDataGuard: JSX.Element = (
  <Scene key="bfm-guard" id="bfm-guard">
    <ProgressManager scrollUnits={2000} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 4, 18]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfm-guard-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfm-guard-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfm-guard-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfm-guard-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="guard-diagram" pivot="center">
        <HierarchicalLayout direction="left-right" spacing={[3, 2]} />

        {/* Guard hub + 4 directives */}
        <DiagramNode id="guard-core" label="Sensitive Data Guard" sublabel="every write boundary · ingestion · consolidation · promotion" size={[8, 2.8]} color="#1a1020" glow={{ intensity: 0.12 }} />
        <DiagramNode id="dir-allow" label="allow_store" sublabel="safe to store as-is" size={[6, 2.4]} color="#102018" />
        <DiagramNode id="dir-redact" label="store_redacted" sublabel="sanitized version · placeholders replace content" size={[6, 2.4]} color="#1a1810" />
        <DiagramNode id="dir-sealed" label="store_sealed" sublabel="sealed vault · audited access · PHI/HIPAA default" size={[6, 2.4]} color="#1a1015" />
        <DiagramNode id="dir-no" label="no_store" sublabel="do not store · event logged as 'content withheld'" size={[6, 2.4]} color="#1a0f0f" />

        <DiagramEdge from="guard-core" to="dir-allow" arrowEnd="open" color="#6050a0" />
        <DiagramEdge from="guard-core" to="dir-redact" arrowEnd="open" color="#6050a0" />
        <DiagramEdge from="guard-core" to="dir-sealed" arrowEnd="open" color="#6050a0" />
        <DiagramEdge from="guard-core" to="dir-no" arrowEnd="open" color="#6050a0" />
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
        THE SENSITIVE DATA GUARD
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            4 storage directives
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>Directive</th>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 0 8px', fontWeight: 500 }}>Behaviour</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['allow_store', 'Safe to store as-is — no transformation'],
                ['store_redacted', 'Sanitized version stored; placeholders replace sensitive content'],
                ['store_sealed', 'Stored in sealed vault; audited access only; default for PHI/HIPAA'],
                ['no_store', "Do not store; event is logged as 'content withheld'"],
              ].map(([directive, desc]) => (
                <tr key={directive} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 8px 6px 0', color: 'rgba(200, 220, 255, 0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>{directive}</td>
                  <td style={{ padding: '6px 0', color: 'rgba(180, 200, 240, 0.75)', fontSize: '0.83rem' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Where it runs
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            The guard runs at every write boundary — EpisodicStore ingestion, Somniocortex
            consolidation, and Neocortex promotion. It is not limited to tool call boundaries.
            Any data path that writes to persistent storage passes through the guard.
          </p>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            CensorCortex at read time
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            At read time, CensorCortex enforces lane-scoped access. Sealed vault contents
            require an audited access token. Redacted content shows placeholders unless
            the requesting lane has explicit clearance. The guard at write time and
            CensorCortex at read time form a complete data protection boundary around
            the memory subsystem.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
