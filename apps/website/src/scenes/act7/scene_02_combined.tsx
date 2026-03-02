import type { JSX } from 'react';
import {
  Scene, Camera, Lighting, Ambient, Directional,
  Floor, FloorMirror, ProgressManager,
} from '@brewsite/core';
import { ModelRouter } from '@brewsite/model';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, ManualLayout, darkGlassTheme } from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [0.5, 1.0] as [number, number], enter: [0.5, 1.0] as [number, number] };

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
      position={(isMobile ? [0, 12, 45] : [-8, 14, 55]) as Vec3}
      target={[5, 3, -5]}
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

    {/* Architecture diagram — right, slightly elevated and angled */}
    <DiagramCanvas
      id="full-diagram"
      rotation={[-Math.PI / 10, -Math.PI / 8, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="full-arch" pivot="center">
        <ManualLayout />
        <DiagramNode id="ui"  label="Web App"    icon="ui:globe-alt"    position={[0, 3, 0]} />
        <DiagramNode id="api" label="API Server" icon="aws:api-gateway" position={[0, 0, 0]} />
        <DiagramNode id="db"  label="Database"   icon="aws:rds"         position={[-2.5, -3, 0]} />
        <DiagramNode id="cdn" label="CDN"        icon="aws:cloudfront"  position={[2.5, -3, 0]} />
        <DiagramEdge from="ui"  to="api" flow="forward" />
        <DiagramEdge from="api" to="db"  flow="forward" />
        <DiagramEdge from="api" to="cdn" flow="forward" style="dashed" />
      </Diagram>
    </DiagramCanvas>

    <div style={{ position: 'absolute', bottom: '8%', left: '5%', maxWidth: 380 }}>
      <MidFade duration={1000}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.55)',
          marginBottom: 12,
        }}>
          Models + Diagrams + HUD + React
        </div>
      </MidFade>
      <ScrollOn duration={1100} delay={120}>
        <div style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: '#f0f6fc', lineHeight: 1.25 }}>
          Web apps. Decks.<br />Pitches. Marketing sites.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
