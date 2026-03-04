import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {config} from "../../settings";

export const sceneSummary: JSX.Element = (
  <Scene key="bfm-summary" id="bfm-summary">
    <ProgressManager scrollUnits={1600} />
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
      maxHeight: '85vh',
      overflowY: 'auto',
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.67rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase' as const,
        color: 'rgba(100, 140, 220, 0.7)',
        marginBottom: 24,
      }}>
        FOUR PARTS. ONE LOOP.
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.89rem', marginBottom: 32 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 16px 12px 0', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Subsystem</th>
            <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 16px 12px 0', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Cognitive analog</th>
            <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 16px 12px 0', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Role</th>
            <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 0 12px', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Key property</th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              subsystem: 'EpisodicStore',
              analog: 'Hippocampus',
              role: 'Records everything that happened across all sessions',
              key: 'Append-only · single-writer · resumable',
            },
            {
              subsystem: 'Somniocortex',
              analog: 'Consolidation sleep',
              role: 'Extracts patterns and proposes typed memory cards out-of-band',
              key: 'LLM proposes · deterministic validates · never in critical path',
            },
            {
              subsystem: 'Neocortex',
              analog: 'Neocortex',
              role: 'Stores validated schematic knowledge across 6 typed card categories',
              key: 'Versioned · provenance-backed · lifecycle-managed',
            },
            {
              subsystem: 'InjectorCortex',
              analog: 'Working memory',
              role: 'Assembles bounded context packs for agent spawn and recall',
              key: 'Token-budget-aware · ordered · reproducible',
            },
          ].map((row) => (
            <tr key={row.subsystem} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '12px 16px 12px 0', color: '#c8d8f0', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.83rem' }}>{row.subsystem}</td>
              <td style={{ padding: '12px 16px 12px 0', color: 'rgba(180, 200, 240, 0.65)' }}>{row.analog}</td>
              <td style={{ padding: '12px 16px 12px 0', color: 'rgba(180, 200, 240, 0.75)' }}>{row.role}</td>
              <td style={{ padding: '12px 0', color: 'rgba(160, 180, 220, 0.65)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>{row.key}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{
        fontSize: 'clamp(0.94rem, 1.8vw, 1.11rem)',
        color: 'rgba(180, 200, 240, 0.8)',
        lineHeight: 1.75,
        maxWidth: 820,
        margin: 0,
        fontStyle: 'italic',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: 24,
      }}>
        Memory in BrewFlow is not a convenience feature. It is what separates an agent that
        is smart for one session from a system that gets reliably better over time.
      </p>
    </div>
  </Scene>
);
