import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene, TextBox} from '@brewsite/core';

export const sceneTradeoffs: JSX.Element = (
  <Scene key="bf-tradeoffs" id="bf-tradeoffs">
    <ProgressManager scrollUnits={1600} />
    <Camera mode="world" position={[0, 0, 5]} target={[0, 0, 0]} fov={50} />
    <Background color="#080b14" />

    <TextBox id="tradeoffs-prose" x={0} y={0.08} w={1} h={0.92}>
      <div style={{
        padding: '48px 60px 56px',
        background: 'rgba(8, 11, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 24,
        }}>
          HONEST TRADE-OFFS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#7ac88a',
              margin: '0 0 16px',
              paddingBottom: 8,
              borderBottom: '1px solid rgba(120, 200, 140, 0.2)',
            }}>
              What this delivers
            </h3>
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'A sidecar that observes, accumulates, and offers — never mandates',
                'Three processes + one .mcp.json + three YAML lines. That\'s the full installation surface',
                'File-based storage (.brewflow/) — no database server, no infrastructure',
                'Graceful degradation at every level: the sidecar being down never blocks agent work',
                'Compounding context quality: every session makes the Neocortex slightly better',
              ].map((item, i) => (
                <li key={i} style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#e87a7a',
              margin: '0 0 16px',
              paddingBottom: 8,
              borderBottom: '1px solid rgba(220, 120, 120, 0.2)',
            }}>
              What it does not deliver
            </h3>
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Gating: the Verifier that blocks bad agent decisions is a separate component',
                'Guaranteed adoption: agents can ignore MCP tools if the Queen doesn\'t instruct them to use it',
                'Instant value: there is nothing in the Neocortex on day one — it starts empty',
                'Perfect capture: if the CDC bridge is not running, events are missed permanently',
              ].map((item, i) => (
                <li key={i} style={{ fontSize: '15px', color: 'rgba(220, 180, 180, 0.8)', lineHeight: 1.6 }}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#c8d8f0',
              margin: '0 0 16px',
              paddingBottom: 8,
              borderBottom: '1px solid rgba(200, 220, 255, 0.15)',
            }}>
              Ramp-up timeline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { period: 'Sessions 1–5', desc: 'Pure observation. Episodic store fills. No Neocortex content yet. This is the baseline.' },
                { period: 'Sessions 5–20', desc: 'First Neocortex cards begin appearing after dreamer runs. Constraints and pitfalls from early failures.' },
                { period: 'Sessions 20–50', desc: 'Meaningful context pack. recall() starts returning genuinely useful constraints and procedures.' },
                { period: 'After session 50', desc: 'Maintenance mode. Neocortex quality plateaus near the asymptote. dreamer runs refine rather than discover.' },
              ].map(({ period, desc }) => (
                <div key={period}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 4 }}>{period}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
