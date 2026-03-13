import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { Diagram, DiagramNode, DiagramEdge, DiagramGroup, HierarchicalLayout, DiagramEnter } from '@brewsite/diagram';
import { neonCyberBundle } from '@brewsite/themes';
import { dwellFn } from '../../utils/pacing';

const neonCyberTheme = neonCyberBundle.diagram.dark;
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const tags = ['Declarative', 'Scroll-Driven', 'TypeScript-First', 'SSR-Safe', 'Mobile-Ready'];

const snippetCode = `// before
<DiagramNode id="api" label="API Gateway" position={[0, 0, 0]} />

// after
<DiagramNode id="api" label="API Gateway" position={[0, 6, 0]} />
<DiagramEdge from="api" to="db" flow="forward" />`;

export const scene02CoreBaked: JSX.Element = (
  <Scene id="website-presentation-02" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={2000}
      fn={dwellFn}
      autoAdvance={{ duration: 8, max: 0.82, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={(isMobile ? [0, 9, 34] : [0, 8, 45]) as Vec3}
      target={[0, -3, 0]}
      fov={isMobile ? 66 : 56}
    />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.9} color="#ffffff" />
      <Directional intensity={0.45} color="#aaccff" position={[4, 14, 8]} />
      <Directional intensity={0.3} color="#00aaff" position={[-10, 10, 8]} />
    </Lighting>

    <Diagram id="presentation-arc" x={0} y={0} w={1} h={1} tilt={-Math.PI / 12} scale={isMobile ? 1.0 : 1.35}>
        <HierarchicalLayout direction="top-down" spacing={[2.2, 2.3]} />
        <DiagramEnter from={[-1, 0.5, 0]} fade easing="ease-out" />

        <DiagramGroup id="context" label="Context" variant="boundary">
          <DiagramNode id="audience" label="Audience" icon="ui:users" />
          <DiagramNode id="constraints" label="Constraints" icon="ui:adjustments-horizontal" />
        </DiagramGroup>

        <DiagramGroup id="narrative" label="Narrative" variant="boundary">
          <DiagramNode id="problem" label="Problem" icon="ui:exclamation-triangle" />
          <DiagramNode id="tradeoffs" label="Tradeoffs" />
          <DiagramNode id="proposal" label="Proposal" icon="ui:sparkles" />
          <DiagramNode id="decision" label="Decision" icon="ui:check-circle" />
        </DiagramGroup>

        <DiagramGroup id="execution" label="Execution" variant="swimlane">
          <DiagramNode id="risks" label="Risks" icon="ui:shield-exclamation" />
          <DiagramNode id="owners" label="Owners" icon="ui:user-group" />
        </DiagramGroup>

        <DiagramEdge from="audience" to="problem" label="frame" flow="forward" />
        <DiagramEdge from="constraints" to="tradeoffs" label="shape" flow="forward" />
        <DiagramEdge from="problem" to="tradeoffs" label="analyze" flow="forward" />
        <DiagramEdge from="tradeoffs" to="proposal" label="choose" flow="forward" />
        <DiagramEdge from="proposal" to="decision" label="align" flow="forward" />
        <DiagramEdge
          from="decision"
          to="risks"
          fromPort="bottom"
          toPort="top"
          label="plan"
          flow="forward"
          style="dashed"
        />
        <DiagramEdge from="decision" to="owners" label="assign" flow="forward" style="dashed" />
      </Diagram>

    <div style={{
      position: 'absolute',
      bottom: '12%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: 820,
      textAlign: 'center',
    }}>
      <MidFade duration={700}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.58)',
          marginBottom: 12,
        }}>
          @brewsite/core
        </div>
      </MidFade>
      <ScrollOn duration={800} delay={80}>
        <p style={{
          fontSize: 'clamp(20px, 2.5vw, 30px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 12,
        }}>
          Describe the state.<br />Ship the transition.
        </p>
      </ScrollOn>
      <ScrollOn duration={700} delay={130}>
        <p style={{
          fontSize: 'clamp(14px, 1.6vw, 16px)',
          color: 'rgba(240,246,252,0.6)',
          lineHeight: 1.6,
          marginBottom: 16,
        }}>
          Author each scene as a JSX snapshot.<br />
          BrewSite animates everything between them.
        </p>
      </ScrollOn>
      <ScrollOn duration={700} delay={170}>
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
          margin: '0 auto 16px',
          textAlign: 'left',
          whiteSpace: 'pre-wrap',
        }}>
          {snippetCode}
        </pre>
      </ScrollOn>
      <ScrollOn duration={700} delay={220}>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              padding: '5px 14px',
              borderRadius: 4,
              border: '1px solid rgba(0,245,255,0.28)',
              background: 'rgba(0,245,255,0.07)',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.07em',
              color: '#00f5ff',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
