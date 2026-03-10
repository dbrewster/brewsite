import type {JSX} from 'react';
import {Scene, Camera, Lighting, Ambient, Directional, ProgressManager} from '@brewsite/core';
import {MidFade, ScrollOn} from '@brewsite/core/hud/animejs';
import {
    Diagram,
    DiagramNode,
    DiagramEdge,
    HierarchicalLayout,
    DiagramEnter,
    neonCyberTheme
} from '@brewsite/diagram';
import {dwellFn} from '../../utils/pacing';
import {isMobile} from '../../utils/viewport';
import type {Vec3} from '@brewsite/core';
import {NeonSign} from "../../widgets/neon-sign";

// Hard cut at transition boundary so each slide starts at its own 0.
const LATE_FADE = {exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number]};

const snippetCode = `<DiagramCanvas theme={neonCyberTheme}>
  <Diagram id="presentation">
    <HierarchicalLayout direction="top-down" />
    <DiagramNode id="problem"  label="Problem"  icon="ui:exclamation-triangle" />
    <DiagramNode id="insight"  label="Insight"  icon="ui:light-bulb" />
    <DiagramNode id="decision" label="Decision" icon="ui:check-circle" />
    <DiagramEdge from="problem"  to="insight"  flow="forward" />
    <DiagramEdge from="insight"  to="decision" flow="forward" />
  </Diagram>
</DiagramCanvas>`;

export const scene01CoreIntro: JSX.Element = (
    <Scene id="website-presentation-01" transition={LATE_FADE}>
        <ProgressManager
            scrollUnits={1800}
            fn={dwellFn}
            autoAdvance={{duration: 8, max: 0.82, pauseOnScroll: true}}
        />
        <Camera mode="world" position={[0, 0, 10]} target={[0, 0, 0]} fov={70} />
        <Lighting intensityScale={1}>
            <Ambient intensity={0.5} color="#e6eeff"/>
            <Directional intensity={0.5} color="#aaccff" position={[0, 20, 26]}/>
            <Directional intensity={0.35} color="#00aaff" position={[-10, 8, 8]}/>
        </Lighting>

        <NeonSign enabled={false} opacity={1} intensity={.8} position={[0, 0, -12]}/>

        <Diagram id="presentation-arc" x={0} y={0} w={1} h={1} tilt={-Math.PI / 11} scale={isMobile ? 1.0 : 1.25} theme={neonCyberTheme}>
                <HierarchicalLayout direction="top-down" spacing={[2.5, 2.4]}/>
                <DiagramEnter from={[-1, 0.5, 0]} fade easing="ease-out" />

                <DiagramNode id="problem" label="Problem" icon="ui:exclamation-triangle"/>
                <DiagramNode id="insight" label="Insight" icon="ui:light-bulb"/>
                <DiagramNode id="decision" label="Decision" icon="ui:check-circle"/>

                <DiagramEdge
                    from="problem"
                    to="insight"
                    fromPort="bottom"
                    toPort="top"
                    label="frame"
                    flow="forward"
                />
                <DiagramEdge
                    from="insight"
                    to="decision"
                    fromPort="bottom"
                    toPort="top"
                    label="align"
                    flow="forward"
                />
            </Diagram>

        <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8% 6%',
        }}>
            <div style={{maxWidth: 420}}>
                <MidFade duration={1400}>
                    <div style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        color: 'rgba(0,245,255,0.6)',
                        marginBottom: 14,
                    }}>
                        @brewsite/core
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(28px, 4.2vw, 54px)',
                        fontWeight: 700,
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        margin: '0 0 16px',
                    }}>
                        Write the scenes.<br/>The compiler renders the film.
                    </h2>
                </MidFade>
                <ScrollOn duration={700} delay={100}>
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
                        margin: '0 0 16px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}>
                        {snippetCode}
                    </pre>
                </ScrollOn>
                <ScrollOn duration={800} delay={200}>
                    <p style={{
                        fontSize: 'clamp(15px, 1.6vw, 18px)',
                        lineHeight: 1.6,
                        color: 'rgba(240,246,252,0.6)',
                        maxWidth: 400,
                    }}>
                        Conference talk. Investor deck. Product demo.<br/>
                        You write the story. BrewSite makes it move.
                    </p>
                </ScrollOn>
            </div>
        </div>
    </Scene>
);
