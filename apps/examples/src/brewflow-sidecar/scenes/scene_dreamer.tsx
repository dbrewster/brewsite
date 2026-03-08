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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDreamer: JSX.Element = (
  <Scene key="bf-dreamer" id="bf-dreamer">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bf-dreamer">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bf-dreamer">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bf-dreamer">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bf-dreamer" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="dreamer-flow">
        <HierarchicalLayout direction="left-right" spacing={[3, 3]} />

        <DiagramNode
          id="d-trigger"
          label="session-end hook"
          sublabel="non-blocking fire"
          size={[6, 2.8]}
          color="#1a2030"
        />
        <DiagramNode
          id="d-dreamer"
          label="brewflow-dreamer"
          sublabel="7-stage pipeline"
          size={[6, 2.8]}
          color="#141830"
          glow={{ intensity: 0.15 }}
        />
        <DiagramNode
          id="d-episodic"
          label="EpisodicStore"
          sublabel="episode bundles + thread_summaries"
          size={[6, 2.8]}
          color="#121a30"
        />
        <DiagramNode
          id="d-neocortex"
          label="Neocortex"
          sublabel="typed cards · verified knowledge"
          size={[6, 2.8]}
          color="#0f1525"
          glow={{ intensity: 0.12 }}
        />

        <DiagramEdge from="d-trigger" to="d-dreamer" label="dream(session_id)" flow="forward" color="#6080c0" />
        <DiagramEdge from="d-dreamer" to="d-episodic" label="query episodes" color="#5070b0" />
        <DiagramEdge from="d-episodic" to="d-dreamer" label="bundles + summaries" style="dashed" color="#4060a0" />
        <DiagramEdge from="d-dreamer" to="d-neocortex" label="Stage 7: publish cards" flow="forward" color="#6090d0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="dreamer-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8, 11, 20, 0.88)',
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
          marginBottom: 16,
        }}>
          THE DREAMING PIPELINE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { stage: 'Stage 1', title: 'Select high-salience episodes', desc: 'Filter EpisodicStore for episodes with high evidence density: multiple agents, explicit store() calls, successful outcomes.' },
                { stage: 'Stage 2', title: 'Extract (LLM)', desc: 'LLM extracts structured facts, rules, constraints, and procedures from episode bundles. Model: claude-haiku-4-5 for throughput.' },
                { stage: 'Stage 3', title: 'Cluster', desc: 'Groups semantically similar extractions. Identifies contradictions and near-duplicates.' },
                { stage: 'Stage 4', title: 'Propose cards (LLM)', desc: 'Drafts typed Neocortex card candidates: constraint, procedure, pitfall, or context. Model: claude-haiku-4-5.' },
              ].map((s) => (
                <div key={s.stage} style={{ padding: '10px 14px', background: 'rgba(20, 28, 60, 0.4)', borderRadius: 5, border: '1px solid rgba(100, 140, 220, 0.1)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.6)', marginBottom: 4 }}>{s.stage}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#c8d8f0', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(180, 200, 240, 0.65)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { stage: 'Stage 5', title: 'Validate', desc: 'Checks proposed cards against existing Neocortex content. Detects conflicts. Filters low-confidence extractions.' },
                { stage: 'Stage 6', title: 'Decide (LLM)', desc: 'Final promotion decision: promote, reject, or merge with existing card. Model: claude-sonnet-4-6 for complex merges.' },
                { stage: 'Stage 7', title: 'Publish cards', desc: 'Writes approved cards to .brewflow/neocortex/ as typed JSON files. Each card has a stable ID and version history.' },
              ].map((s) => (
                <div key={s.stage} style={{ padding: '10px 14px', background: 'rgba(20, 28, 60, 0.4)', borderRadius: 5, border: '1px solid rgba(100, 140, 220, 0.1)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.6)', marginBottom: 4 }}>{s.stage}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#c8d8f0', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(180, 200, 240, 0.65)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
              <div style={{ padding: '10px 14px', background: 'rgba(20, 28, 60, 0.25)', borderRadius: 5, borderLeft: '3px solid rgba(100, 140, 220, 0.3)' }}>
                <div style={{ fontSize: '13px', color: 'rgba(180, 200, 240, 0.65)', lineHeight: 1.6 }}>
                  <strong style={{ color: '#a0b8e0' }}>Models used:</strong> claude-haiku-4-5 for
                  extract/propose (high throughput, low cost). claude-sonnet-4-6 for complex promotion
                  decisions requiring nuanced judgment.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
