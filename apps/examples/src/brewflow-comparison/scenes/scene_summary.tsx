import type {JSX} from 'react';
import {Background, Camera, Scene, TextBox} from '@brewsite/core';

export const sceneSummary: JSX.Element = (
  <Scene key="bfc-summary" id="bfc-summary">
    <TextBox id="summary-content" x={0.04} y={0.06} w={0.92} h={0.88}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 64px 56px',
        background: 'rgba(8, 11, 20, 0.92)',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 24,
        }}>
          THE HONEST TRADE-OFF
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
          marginBottom: 40,
        }}>
          {/* Left — claude-flow */}
          <div>
            <h2 style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#c8d8f0',
              margin: '0 0 20px',
              borderBottom: '1px solid rgba(100, 140, 220, 0.2)',
              paddingBottom: 12,
            }}>
              claude-flow — what it does well
            </h2>
            <ul style={{
              margin: 0,
              padding: '0 0 0 1.1rem',
              listStyle: 'disc',
              color: 'rgba(180, 200, 240, 0.75)',
            }}>
              {[
                'Simple, single-file SQLite state — easy to inspect and debug',
                'Effective swarm coordination via shared_state blackboard',
                'Fast consensus for bounded multi-agent tasks',
                'Low infrastructure overhead — works out of the box',
                'TTL-based credential management adequate for most use cases',
                'Process recovery via workflow_state snapshots',
                'Accumulates patterns across sessions with minimal configuration',
              ].map((item) => (
                <li key={item} style={{ fontSize: 18, lineHeight: 1.7, marginBottom: 6 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — BrewFlow */}
          <div>
            <h2 style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#c8d8f0',
              margin: '0 0 20px',
              borderBottom: '1px solid rgba(100, 140, 220, 0.2)',
              paddingBottom: 12,
            }}>
              BrewFlow — what it adds
            </h2>
            <ul style={{
              margin: 0,
              padding: '0 0 0 1.1rem',
              listStyle: 'disc',
              color: 'rgba(180, 200, 240, 0.75)',
            }}>
              {[
                'Compounding memory quality — session 50 gets better context than session 1',
                'Epistemic separation — LLM proposes, deterministic validators decide',
                'Full lineage closure for post-incident investigation',
                'Reproducible, token-bounded context assembly via InjectorCortex',
                'Sensitive Data Guard for regulated environments (PHI, PII, HIPAA)',
                'Epistemic checkpoint-restart — fresh agents with full knowledge context',
                'Evidence gates over consensus voting for high-stakes decisions',
              ].map((item) => (
                <li key={item} style={{ fontSize: 18, lineHeight: 1.7, marginBottom: 6 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <blockquote style={{
          borderLeft: '3px solid rgba(100, 140, 220, 0.4)',
          margin: 0,
          padding: '20px 28px',
          background: 'rgba(20, 28, 50, 0.5)',
          borderRadius: '0 8px 8px 0',
        }}>
          <p style={{
            fontSize: 18,
            color: 'rgba(200, 215, 245, 0.85)',
            lineHeight: 1.7,
            fontStyle: 'italic',
            margin: 0,
          }}>
            "The gap between a frequency-counted pattern table and a validated, provenance-backed
            schematic memory store is the gap between hoping the system gets smarter and
            engineering it to."
          </p>
        </blockquote>
      </div>
    </TextBox>
  </Scene>
);
