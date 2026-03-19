import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager, TextBox,
} from '@brewsite/core';
import { Model, Playback, Animation } from '@brewsite/model';
import { Diagram, DiagramNode, DiagramEdge, ManualLayout } from '@brewsite/diagram';
import { isMobile } from '../../utils/viewport';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `<Model type="Worker" id="character"
  x={0.15} y={0} w={0.35} h={1} scale={0.001}>
  <Playback>
    <Animation clipName="idle" weight={1} />
  </Playback>
</Model>
<DiagramCanvas>
  <DiagramNode id="api" label="API Server" icon="aws:api-gateway" />
  <DiagramEdge from="api" to="db" flow="forward" />
</DiagramCanvas>`;

export const scene02Combined: JSX.Element = (
  <Scene id="website-full-02" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      fn={dwellFn}
      autoAdvance={{ duration: 7, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera
      mode="world"
      position={isMobile ? [0, 2, 8] : [-2, 2, 7]}
      target={[0, 0, 0]}
      fov={isMobile ? 65 : 60}
    />

    <Floor enabled position={[0, 0, 0]}>
      <FloorMirror
        mirrorColor="#050810"
        mirrorOpacity={0.22}
        mirrorResolution={512}
        mirrorClipBias={0.003}
      />
    </Floor>
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#e0eaff" />
      <Directional intensity={0.8} color="#ffffff" position={[5, 25, 25]} />
      <Directional intensity={0.35} color="#0055ff" position={[-12, 10, 10]} />
    </Lighting>

    {/* Worker character — left of diagram */}
    <Model
      type="FemaleDummy"
      id="combined-character"
      x={0.15}
      y={0}
      w={0.35}
      h={1}
      scale={0.001}
      rotation={[0, Math.PI / 6, 0]}
      metalnessMultiplier={0.4}
      roughnessMultiplier={2}
    >
      <Playback>
        <Animation clipName="chat-talkandlaugh-f" enabled weight={1} />
      </Playback>
    </Model>

    {/* Architecture diagram — right, slightly elevated and angled */}
    <Diagram id="full-arch" x={0} y={0} w={1} h={1} tilt={-Math.PI / 10} scale={1.1}>
        <ManualLayout />
        <DiagramNode id="ui"  label="Web App"    icon="ui:globe-alt"    position={[0.500, 0.167, 0]} size={[0.15, 0.15]} />
        <DiagramNode id="api" label="API Server" icon="aws:api-gateway" position={[0.500, 0.500, 0]} size={[0.15, 0.15]} />
        <DiagramNode id="db"  label="Database"   icon="aws:rds"         position={[0.188, 0.833, 0]} size={[0.15, 0.15]} />
        <DiagramNode id="cdn" label="CDN"        icon="aws:cloudfront"  position={[0.813, 0.833, 0]} size={[0.15, 0.15]} />
        <DiagramEdge from="ui"  to="api" flow="forward" />
        <DiagramEdge from="api" to="db"  flow="forward" />
        <DiagramEdge from="api" to="cdn" flow="forward" style="dashed" />
      </Diagram>

    <TextBox key="combined-overlay" x={0.03} y={0.58} w={0.35} h={0.40} overflow="visible">
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: 'rgba(0,245,255,0.55)',
        marginBottom: 12,
      }}>
        Models + Diagrams + React
      </div>
      <div style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: '#f0f6fc', lineHeight: 1.25, marginBottom: 16 }}>
        Web apps. Decks.<br />Pitches. Marketing sites.
      </div>
      <pre style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 'clamp(11px, 1.2vw, 13px)',
        lineHeight: 1.7,
        color: '#00f5ff',
        background: 'rgba(0,245,255,0.04)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 6,
        padding: 16,
        maxWidth: 400,
        margin: '0 0 14px',
        whiteSpace: 'pre-wrap',
      }}>
        {snippetCode}
      </pre>
      <div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
        One EngineProvider. Everything compiled.<br />
        TypeScript end to end.
      </div>
    </TextBox>
  </Scene>
);
