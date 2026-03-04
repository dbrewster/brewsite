import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneHooks: JSX.Element = (
  <Scene key="bf-hooks" id="bf-hooks">
    <ProgressManager scrollUnits={2000} fn={DWELL_FN} />
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
      maxHeight: '80vh',
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
        COMPONENT 3: HOOK WIRING
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Available environment variables
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>Variable</th>
                <th style={{ textAlign: 'left', color: 'rgba(100, 140, 220, 0.7)', padding: '4px 8px 8px 0', fontWeight: 500 }}>Contents</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['$AGENT_ID', 'Calling agent identifier'],
                ['$TASK_ID', 'Current task identifier'],
                ['$SESSION_ID', 'Session identifier'],
                ['$SUCCESS', 'true | false (post-task only)'],
                ['$EXIT_CODE', 'Numeric exit code (post-task)'],
                ['$TASK_OUTPUT', 'Captured stdout (capture: stdout)'],
                ['$AGENT_TYPE', 'orchestrator | worker | specialist'],
              ].map(([v, d]) => (
                <tr key={v} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '5px 8px 5px 0', color: '#8ab4f8', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>{v}</td>
                  <td style={{ padding: '5px 0', color: 'rgba(180, 200, 240, 0.75)', fontSize: '0.83rem' }}>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Hook declarations (agent YAML)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(20, 28, 60, 0.5)', borderRadius: 6, border: '1px solid rgba(100, 140, 220, 0.12)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>pre-task</div>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8ab4f8', display: 'block', lineHeight: 1.6, whiteSpace: 'pre' }}>
                {`command: npx brewflow recall
capture: stdout
timeout_ms: 3000
on_failure: skip`}
              </code>
              <div style={{ fontSize: '0.83rem', color: 'rgba(180, 200, 240, 0.65)', marginTop: 8, lineHeight: 1.6 }}>
                Injects Neocortex context into agent's stdout capture before task begins.
                on_failure: skip means a missing sidecar never blocks a task.
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(20, 28, 60, 0.5)', borderRadius: 6, border: '1px solid rgba(100, 140, 220, 0.12)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>post-task</div>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8ab4f8', display: 'block', lineHeight: 1.6, whiteSpace: 'pre' }}>
                {`command: npx brewflow checkpoint --success=$SUCCESS
async: true
timeout_ms: 2000
on_failure: skip`}
              </code>
              <div style={{ fontSize: '0.83rem', color: 'rgba(180, 200, 240, 0.65)', marginTop: 8, lineHeight: 1.6 }}>
                Fire-and-forget checkpoint + thread_summary. async: true means task completion
                is not blocked on memory recording.
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(20, 28, 60, 0.5)', borderRadius: 6, border: '1px solid rgba(100, 140, 220, 0.12)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>session-end</div>
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8ab4f8', display: 'block', lineHeight: 1.6, whiteSpace: 'pre' }}>
                {`command: npx brewflow dream --session=$SESSION_ID &
async: true
on_failure: skip`}
              </code>
              <div style={{ fontSize: '0.83rem', color: 'rgba(180, 200, 240, 0.65)', marginTop: 8, lineHeight: 1.6 }}>
                Fires the dreamer as a non-blocking background process. The & ensures
                the hook returns immediately. Dreamer runs independently of claude-flow.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: '16px', background: 'rgba(20, 28, 60, 0.4)', borderRadius: 6, borderLeft: '3px solid rgba(100, 140, 220, 0.3)' }}>
        <div style={{ fontSize: '0.89rem', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Queen system prompt addendum</div>
        <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
          The Queen (orchestrator) agent's system prompt includes a "Memory System (BrewFlow)" section
          that instructs it to: call recall() before spawning workers with complex tasks, pass the
          context pack in worker task instructions, call log_outcome() after task completion, and use
          checkpoint() to build restart packets for failed workers. Workers receive this context in their
          task instructions — they never need to call memory tools themselves unless they discover
          something worth storing.
        </p>
      </div>
    </div>
  </Scene>
);
