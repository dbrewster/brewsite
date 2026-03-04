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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneEpisodicStore: JSX.Element = (
  <Scene key="bfm-episodic" id="bfm-episodic">
    <ProgressManager scrollUnits={3000} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 5, 24]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfm-episodic-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfm-episodic-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfm-episodic-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfm-episodic-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="episodic-diagram" pivot="center">
        <ManualLayout />

        {/* Hub */}
        <DiagramNode id="es-core" label="EpisodicStore" sublabel=".brewflow/episodic/ · JSONL · globalEventSeq" size={[7, 2.8]} position={[0, 0, 0]} color="#141830" glow={{ intensity: 0.18 }} />

        {/* 5 record kinds */}
        <DiagramNode id="es-runtime" label="runtime_event" sublabel="tool calls · results · agent output · token usage" size={[6.5, 2.4]} position={[-10, 6, 0]} color="#101828" />
        <DiagramNode id="es-turns" label="turns_status" sublabel="turn lifecycle · started · completed · failed · interrupted" size={[6.5, 2.4]} position={[10, 6, 0]} color="#101828" />
        <DiagramNode id="es-summary" label="thread_summary" sublabel="compact end-of-thread summaries · consolidation input" size={[6.5, 2.4]} position={[-10, -6, 0]} color="#101828" />
        <DiagramNode id="es-synaptic" label="synaptic_event" sublabel="cross-agent signals · specialist coordination" size={[6.5, 2.4]} position={[10, -6, 0]} color="#101828" />
        <DiagramNode id="es-lineage" label="lineage_update" sublabel="session → plan → thread → turn trace mappings" size={[6.5, 2.4]} position={[0, -9, 0]} color="#101828" />

        {/* Spoke edges */}
        <DiagramEdge from="es-core" to="es-runtime" color="#4060a0" />
        <DiagramEdge from="es-core" to="es-turns" color="#4060a0" />
        <DiagramEdge from="es-core" to="es-summary" color="#4060a0" />
        <DiagramEdge from="es-core" to="es-synaptic" color="#4060a0" />
        <DiagramEdge from="es-core" to="es-lineage" color="#4060a0" />
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
      maxHeight: '50vh',
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
        EPISODIC STORE — WHAT HAPPENED
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Append-only event log
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            EpisodicStore is a strictly append-only log of everything that happened across
            all sessions. Records are never modified or deleted — only appended. Each JSONL
            segment file covers a bounded time window and is sealed when closed.
          </p>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Safety properties
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            Single-writer per segment enforced by an exclusive lock. Path safety validated
            before every write. Immutability guaranteed — sealed segments are never reopened.
            Resumability contract: any crashed session can be reconstructed from the log alone.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Five record kinds
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>Kind</th>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 0 8px', fontWeight: 500 }}>What it captures</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['runtime_event', 'Tool calls, results, agent output, token usage'],
                ['turns_status', 'Turn lifecycle: started · completed · failed · interrupted'],
                ['thread_summary', 'Compact end-of-thread summaries — consolidation input'],
                ['synaptic_event', 'Cross-agent signals and specialist coordination'],
                ['lineage_update', 'Session → plan → thread → turn trace mappings'],
              ].map(([kind, desc]) => (
                <tr key={kind} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 8px 6px 0', color: 'rgba(200, 220, 255, 0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>{kind}</td>
                  <td style={{ padding: '6px 0', color: 'rgba(180, 200, 240, 0.75)', fontSize: '0.83rem' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Scene>
);
