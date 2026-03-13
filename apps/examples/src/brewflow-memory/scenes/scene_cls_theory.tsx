import type {JSX} from 'react';
import {
  Background,
  Camera,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneClsTheory = () => (
  <Scene key="bfm-cls" id="bfm-cls">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Diagram id="cls-diagram" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale}>
        <ManualLayout />
        <DiagramEnter fade />

        {/* Left column — cognitive science analog (muted) */}
        <DiagramNode id="cog-hippo" label="Hippocampus" sublabel="fast learning · high fidelity · specific episodes" size={[0.269, 0.157]} position={[0.192, 0.163, 0]} color="#1a1525" />
        <DiagramNode id="cog-consol" label="Consolidation" sublabel="sleep replay · pattern extraction · pruning noise" size={[0.269, 0.157]} position={[0.192, 0.387, 0]} color="#1a1525" />
        <DiagramNode id="cog-neo" label="Neocortex" sublabel="slow learning · generalization · stable patterns" size={[0.269, 0.157]} position={[0.192, 0.613, 0]} color="#1a1525" />
        <DiagramNode id="cog-work" label="Working Memory" sublabel="bounded · task-scoped · assembled on demand" size={[0.269, 0.157]} position={[0.192, 0.837, 0]} color="#1a1525" />

        {/* Right column — BrewFlow implementation (glowing) */}
        <DiagramNode id="bf-episodic" label="EpisodicStore" sublabel="append-only · global event sequence · JSONL segments" size={[0.269, 0.157]} position={[0.808, 0.163, 0]} color="#141830" glow={{ intensity: 0.15 }} />
        <DiagramNode id="bf-somno" label="Somniocortex" sublabel="7-stage dreaming pipeline · out-of-band · LLM proposes" size={[0.269, 0.157]} position={[0.808, 0.387, 0]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="bf-neo" label="Neocortex Store" sublabel="typed cards · versioned · provenance-backed · verified" size={[0.269, 0.157]} position={[0.808, 0.613, 0]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="bf-inject" label="InjectorCortex" sublabel="token-budget-aware · ordered · reproducible packs" size={[0.269, 0.157]} position={[0.808, 0.837, 0]} color="#141830" glow={{ intensity: 0.1 }} />

        {/* Mapping edges */}
        <DiagramEdge from="cog-hippo" to="bf-episodic" label="→" routing="straight" color="#5060a0" arrowEnd="open" />
        <DiagramEdge from="cog-consol" to="bf-somno" label="→" routing="straight" color="#5060a0" arrowEnd="open" />
        <DiagramEdge from="cog-neo" to="bf-neo" label="→" routing="straight" color="#5060a0" arrowEnd="open" />
        <DiagramEdge from="cog-work" to="bf-inject" label="→" routing="straight" color="#5060a0" arrowEnd="open" />
      </Diagram>

    <TextBox id="bfm-cls-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE COGNITIVE SCIENCE FOUNDATION
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
        }}>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Complementary Learning Systems theory
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              CLS theory proposes that durable long-term memory requires two cooperating systems:
              a fast hippocampal store for high-fidelity episodic capture, and a slow neocortical
              system that consolidates patterns during offline periods. Neither system alone is
              sufficient — the hippocampus catastrophically forgets without consolidation; the
              neocortex cannot learn quickly without damaging existing knowledge.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Why two systems — incompatible optimization targets
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              Fast learning (hippocampus) requires high plasticity and specific encoding — optimized
              for exact recall. Slow learning (neocortex) requires low plasticity and distributed
              encoding — optimized for generalization. These are incompatible: a single system
              cannot be both plastic enough for fast capture and stable enough for long-term storage.
              BrewFlow maps EpisodicStore to the hippocampus, Somniocortex to consolidation sleep,
              and Neocortex Store to durable schematic memory.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
