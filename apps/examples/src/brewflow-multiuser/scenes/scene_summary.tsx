import type {JSX} from 'react';
import {Background, Camera, Scene, TextBox} from '@brewsite/core';

export const sceneSummary: JSX.Element = (
  <Scene key="bfmu-summary" id="bfmu-summary">
    <Camera mode="world" position={[0, 0, 5]} target={[0, 0, 0]} fov={50} />
    <Background color="#080b14" />

    <TextBox id="summary-content" x={0.04} y={0.06} w={0.92} h={0.88}>
      <div style={{
        padding: '48px 64px 56px',
        background: 'rgba(8, 11, 20, 0.92)',
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
          marginBottom: 24,
        }}>
          SIX PRINCIPLES + THE GUARDS THAT HOLD
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: 32 }}>
          <div>
            <h3 style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#c8d8f0',
              margin: '0 0 16px',
              paddingBottom: 8,
              borderBottom: '1px solid rgba(200, 220, 255, 0.12)',
            }}>
              Six cloud architecture principles
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  n: '1',
                  title: 'Partition by identity',
                  desc: 'Every episodic write path is keyed by tenantId+projectId+userId+sessionId+agentId+threadId. No two identities share a write path. Contention eliminated by design.',
                },
                {
                  n: '2',
                  title: 'Three Neocortex planes',
                  desc: 'User → Project → Org, with escalating evidence thresholds and human approval requirements. Context packs always inject in authority order. A user preference cannot shadow an org constraint.',
                },
                {
                  n: '3',
                  title: 'Slice + queue',
                  desc: 'Concurrent extraction (Phase A), serialized promotion (Phase B). Dreamers run in parallel because they touch disjoint data. The promotion queue ensures writes to shared Neocortex are ordered.',
                },
                {
                  n: '4',
                  title: 'Conflicts surface, not merge',
                  desc: 'Contradictory claims produce a conflict record. Both items are flagged [disputed] in context packs. Humans resolve. The system never silently picks a winner.',
                },
                {
                  n: '5',
                  title: 'Session tracking as backbone',
                  desc: 'The session record — sessionId, userId, agentId, startedAt, endedAt, status — is the primary partition key for everything. It enables replay, audit, and attribution.',
                },
                {
                  n: '6',
                  title: 'Degradation toward local',
                  desc: 'If the promotion queue is unavailable, dreamers write to user-scope Neocortex. If user-scope is unavailable, results are queued locally. The critical write path (agent work) is never blocked by memory infrastructure.',
                },
              ].map(({ n, title, desc }) => (
                <div key={n} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    color: 'rgba(100, 140, 220, 0.5)',
                    minWidth: 16,
                    paddingTop: 2,
                  }}>{n}</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#c8d8f0', marginBottom: 3 }}>{title}</div>
                    <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#c8d8f0',
              margin: '0 0 16px',
              paddingBottom: 8,
              borderBottom: '1px solid rgba(200, 220, 255, 0.12)',
            }}>
              Guards that hold from the debate model
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  title: 'LLMs argue and propose; validators accept',
                  desc: 'No expert or moderator output is written directly to Neocortex. All proposals pass through the Stage 5–7 promotion worker, which applies validation rules independent of the LLM outputs.',
                },
                {
                  title: 'Humans gate high-risk',
                  desc: 'Org-Neocortex always requires human approval. Project-Neocortex items above the confidence threshold or flagged as security-sensitive require human review. The system cannot escalate autonomously past project scope.',
                },
                {
                  title: 'Stalemates surface, not merge',
                  desc: 'A debate that reaches no convergence becomes a stalemate. The full transcript is preserved. Both conflicting positions are flagged [disputed]. The human sees exactly what the experts disagreed about.',
                },
                {
                  title: 'Withdrawal is clean',
                  desc: 'When an expert withdraws a claim in Round 1, it is removed from their proposal set with a reason logged. Withdrawn claims do not count toward convergence and do not reach Stage 5. Clean exit, no ghost data.',
                },
              ].map(({ title, desc }) => (
                <div key={title}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#c8d8f0', marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '18px',
          color: 'rgba(160, 180, 220, 0.65)',
          fontStyle: 'italic',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 20,
          lineHeight: 1.7,
        }}>
          The expert debate model adds Scale 1 rigor without changing any of the pipeline's fundamental
          epistemic constraints. Identity partitioning, three Neocortex planes, slice+queue architecture,
          and conflict surfacing all operate identically whether extraction uses a single LLM pass or a
          full five-expert debate. The debate strengthens what enters the pipeline; the pipeline's safety
          properties constrain what exits it.
        </div>
      </div>
    </TextBox>
  </Scene>
);
