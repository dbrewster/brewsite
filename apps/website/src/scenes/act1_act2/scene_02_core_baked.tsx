import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, DiagramGroup, HierarchicalLayout, DiagramEnter, neonCyberTheme } from '@brewsite/diagram';
import { dwellFn } from '../../utils/pacing';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const tags = ['Narrative First', 'Animate The Why', 'Decision Clarity', 'Technical Depth'];

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

    <DiagramCanvas
      id="presentation-flow"
      rotation={[-Math.PI / 12, 0, 0]}
      scale={isMobile ? 1.0 : 1.35}
      theme={neonCyberTheme}
    >
      <Diagram id="presentation-arc" pivot="center">
        <HierarchicalLayout direction="top-down" spacing={[2.2, 2.3]} />
        <DiagramEnter from={[-30, 0, 0]} fade easing="ease-out" />

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
    </DiagramCanvas>

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
          Slide Two: Build The Full Argument
        </div>
      </MidFade>
      <ScrollOn duration={800} delay={80}>
        <p style={{
          fontSize: 'clamp(20px, 2.5vw, 30px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.3,
          marginBottom: 18,
        }}>
          Go from one idea to stakeholder-ready narrative<br />
          without leaving the same scene system.
        </p>
      </ScrollOn>
      <ScrollOn duration={700} delay={170}>
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
