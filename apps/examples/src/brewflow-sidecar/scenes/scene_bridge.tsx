import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneBridge: JSX.Element = (
  <Scene key="bf-bridge" id="bf-bridge">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 0, 5]} target={[0, 0, 0]} fov={50} />
    <Background color="#080b14" />

    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '48px 64px 56px',
      background: 'rgba(8, 11, 20, 0.92)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      maxHeight: '75vh',
      overflowY: 'auto',
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.67rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase' as const,
        color: 'rgba(100, 140, 220, 0.7)',
        marginBottom: 20,
      }}>
        COMPONENT 1: THE CDC BRIDGE
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px',
      }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            What it does
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            A lightweight process watching .swarm/memory.db. It is the only component with
            zero agent involvement — completely passive. Claude-flow writes its normal activity
            to the database; the bridge picks it up.
          </p>

          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '20px 0 12px', fontWeight: 600 }}>
            Read-only access without write permissions
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            Opens the SQLite connection in read-only mode with WAL journal mode.
            Tracks the highest seen rowid per table using a cursor file in .brewflow/.
            On each poll interval (500ms), reads rows where rowid {'>'} cursor.
            Never acquires a write lock — safe to run alongside any number of claude-flow writers.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Row transformation map
          </h3>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.83rem',
          }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>Source table</th>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>→ Episodic event type</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['events', 'runtime_event'],
                ['shared_state', 'synaptic_event'],
                ['sessions', 'episode boundaries'],
                ['patterns', 'consolidation candidates'],
                ['tasks', 'turns_status'],
              ].map(([src, dst]) => (
                <tr key={src} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 8px 6px 0', color: 'rgba(200, 220, 255, 0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>{src}</td>
                  <td style={{ padding: '6px 0', color: 'rgba(180, 200, 240, 0.75)', fontSize: '0.83rem' }}>{dst}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '20px 0 12px', fontWeight: 600 }}>
            Deduplication & health
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            Each event is hash-keyed on (table, rowid). Duplicate ingestion is idempotent —
            re-processed rows are skipped. A heartbeat record is written to EpisodicStore
            every 60 seconds; absence for {'>'} 5 minutes triggers a bridge health alert.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
