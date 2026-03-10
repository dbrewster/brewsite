import type {JSX} from 'react';
import {
  Background,
  Camera,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneLearningLoop = () => (
  <Scene key="bfm-loop" id="bfm-loop">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Diagram id="loop-diagram" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
        <ManualLayout />
        <DiagramEnter fade />

        {/* Circular flow — 5 nodes arranged for clockwise loop */}
        <DiagramNode id="loop-agent" label="Agent Session" sublabel="records new episodes · receives context pack" size={[0.292, 0.203]} position={[0.208, 0.210, 0]} color="#1a2545" glow={{ intensity: 0.1 }} />
        <DiagramNode id="loop-episodic" label="EpisodicStore" sublabel="everything recorded in real time · automatic" size={[0.292, 0.203]} position={[0.792, 0.210, 0]} color="#141830" />
        <DiagramNode id="loop-somno" label="Somniocortex" sublabel="batch · triggered · out-of-band · not every episode" size={[0.292, 0.203]} position={[0.792, 0.790, 0]} color="#141830" />
        <DiagramNode id="loop-neo" label="Neocortex" sublabel="validated knowledge · typed cards · lifecycle-managed" size={[0.292, 0.203]} position={[0.208, 0.790, 0]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="loop-inject" label="InjectorCortex" sublabel="fast · on-demand · bounded · agent spawn" size={[0.292, 0.203]} position={[0.208, 0.500, 0]} color="#141830" />

        {/* Clockwise loop edges */}
        <DiagramEdge from="loop-agent" to="loop-episodic" label="continuous · automatic" flow="forward" color="#6080c0" />
        <DiagramEdge from="loop-episodic" to="loop-somno" label="triggered · batch" style="dashed" color="#4060a0" />
        <DiagramEdge from="loop-somno" to="loop-neo" label="validated proposals" flow="forward" color="#5070b0" />
        <DiagramEdge from="loop-neo" to="loop-inject" label="curated library" color="#5070b0" />
        <DiagramEdge from="loop-inject" to="loop-agent" label="bounded context pack" flow="forward" color="#6090d0" />
      </Diagram>

    <TextBox id="bfm-loop-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '40px 64px 48px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          THE LEARNING LOOP
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '28px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Asymmetric by design
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              The loop has three distinct tempos. Recording is continuous and automatic — every
              event is appended to EpisodicStore in real time with no agent decision required.
              Consolidation is slow and batch — Somniocortex runs out-of-band and only when
              triggered. Retrieval is fast and on-demand — InjectorCortex assembles context
              packs synchronously at agent spawn time.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Three key asymmetries
            </h3>
            <ul style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.8, margin: 0, padding: 0, listStyle: 'none' }}>
              <li style={{ marginBottom: 8 }}>
                <span style={{ color: '#c8d8f0', fontWeight: 600 }}>Slow batch vs fast on-demand.</span>{' '}
                Consolidation cannot be in the critical path — it takes seconds to minutes.
                Retrieval must complete in milliseconds.
              </li>
              <li style={{ marginBottom: 8 }}>
                <span style={{ color: '#c8d8f0', fontWeight: 600 }}>Not every episode becomes a card.</span>{' '}
                Somniocortex selects, clusters, and filters. Most episodes are never consolidated —
                only recurring patterns with sufficient evidence.
              </li>
              <li>
                <span style={{ color: '#c8d8f0', fontWeight: 600 }}>Cards outlive sessions.</span>{' '}
                A card promoted to "verified" in Neocortex persists until explicitly deprecated.
                The loop compounds — each session adds to a growing library of validated knowledge.
              </li>
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Getting smarter over time
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              After 10 sessions, the Neocortex library contains constraints, procedures, and
              pitfalls extracted from 10 rounds of real work. The 11th session agent starts
              with a context pack built from that library — it knows what the previous 10
              agents learned. Each iteration of the loop makes the next iteration better.
              This is the compounding property.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
