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
    WheelMap,
} from '@brewsite/core';
import {
    Diagram,
    DiagramCanvas,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    FlowLayout,
    GridLayout,
    HierarchicalLayout,
} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneSomniocortex: JSX.Element = (
    <Scene key="bfm-somniocortex" id="bfm-somniocortex">
        <ProgressManager scrollUnits={3200} fn={DWELL_FN}/>
        <Camera mode="world" position={[0, 5, 28]} target={[0, 0, 0]} fov={52}/>
        <Background color="#080b14"/>

        <InputController scope="canvas">
            <Action id="pan" type="diagram-canvas.move" canvasId="bfm-somno-canvas">
                <PointerMap event="drag" axis="xy"/>
                <WheelMap axis="xy"/>
            </Action>
            <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfm-somno-canvas">
                <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy"/>
            </Action>
            <Action id="reset" type="diagram-canvas.reset" canvasId="bfm-somno-canvas">
                <KeyMap keyName="r"/>
            </Action>
        </InputController>

        <DiagramCanvas id="bfm-somno-canvas" rotation={[config.diagramRotationX, 0, 0]} scale={.7}
                       position={[0, config.diagramTop +2, 0]}
                       theme={brewflowTheme}>
            <Diagram id="somno-diagram" pivot="center">
                <FlowLayout direction="top-down" gap={2}/>

                <DiagramNode id="in-episodic" label="EpisodicStore" sublabel="raw episodes"
                             size={[7, 2.8]} color="#101828" />

                <DiagramGroup id="pipeline-stages">
                    <GridLayout columns={4} spacing={[1.5, 2]} />
                    <DiagramNode id="s1" label="1. Select" sublabel="salience · recency · triggers"
                                 size={[5, 2.8]} color="#121a30" />
                    <DiagramNode id="s2" label="2. Extract" sublabel="LLM-assisted · candidates only · prompt editable"
                                 size={[5, 2.8]} color="#121a30" />
                    <DiagramNode id="s3" label="3. Cluster" sublabel="cross-episode grouping · prevents overfitting"
                                 size={[5, 2.8]} color="#121a30" />
                    <DiagramNode id="s4" label="4. Propose" sublabel="typed structured records · full provenance"
                                 size={[5, 2.8]} color="#141c35" />
                    <DiagramNode id="s5" label="5. Validate" sublabel="deterministic validators only · LLM role ends here"
                                 size={[5, 2.8]} color="#141c35" glow={{intensity: 0.1}} />
                    <DiagramNode id="s6" label="6. Decide" sublabel="evidence-weighted · contradictions → review"
                                 size={[5, 2.8]} color="#141c35" />
                    <DiagramNode id="s7" label="7. Publish" sublabel="versioned delta → Neocortex · audit record"
                                 size={[5, 2.8]} color="#151e38" glow={{intensity: 0.15}} />
                </DiagramGroup>

                <DiagramNode id="out-neo" label="Neocortex" sublabel="validated cards"
                             size={[7, 2.8]} color="#101828" glow={{intensity: 0.12}} />

                {/* Cross-group edges — used for visual edge routing only with FlowLayout */}
                <DiagramEdge from="in-episodic" to="s1"      flow="forward" color="#5070b0" />
                <DiagramEdge from="s1" to="s2"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s2" to="s3"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s3" to="s4"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s4" to="s5"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s5" to="s6"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s6" to="s7"               flow="forward" color="#5070b0" />
                <DiagramEdge from="s7" to="out-neo"          flow="forward" color="#5070b0" />
            </Diagram>
        </DiagramCanvas>

        <TextBox id="bfm-somno-prose" x={0} y={0.58} w={1} h={0.42}>
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
                    SOMNIOCORTEX — WHAT IT MEANS
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px'}}>
                    <div>
                        <h3 style={{fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
                            The dreaming pipeline
                        </h3>
                        <p style={{
                            fontSize: '15px',
                            color: 'rgba(180, 200, 240, 0.75)',
                            lineHeight: 1.7,
                            margin: '0 0 16px'
                        }}>
                            Somniocortex runs out-of-band — triggered by session end, time schedule, or
                            explicit request. It is never in the critical path of an active agent. The pipeline
                            reads from EpisodicStore, runs 7 stages, and writes validated proposals to the
                            Neocortex Store. The dreamer can be re-run as many times as needed; each run
                            is idempotent given the same episode window.
                        </p>
                        <h3 style={{fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
                            Why LLM role ends at stage 5
                        </h3>
                        <p style={{fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0}}>
                            The LLM's role is to propose, not to decide. Stages 1–4 use LLM reasoning to
                            select relevant episodes, extract candidates, cluster cross-episode patterns,
                            and propose typed structured records. Stage 5 runs deterministic validators —
                            schema, provenance, format, contradiction checks — without LLM involvement.
                            The LLM cannot hallucinate its way past stage 5.
                        </p>
                    </div>
                    <div>
                        <h3 style={{fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
                            What happens if the dreamer fails
                        </h3>
                        <p style={{
                            fontSize: '15px',
                            color: 'rgba(180, 200, 240, 0.75)',
                            lineHeight: 1.7,
                            margin: '0 0 16px'
                        }}>
                            A dreamer failure never corrupts existing memory. If the pipeline crashes at
                            any stage, the in-progress proposals are discarded — nothing is published to
                            Neocortex. The EpisodicStore is untouched. The next scheduled run will pick
                            up where the episode window left off.
                        </p>
                        <h3 style={{fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
                            Stage 6 decision logic
                        </h3>
                        <p style={{fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0}}>
                            Stage 6 compares the proposal against existing Neocortex cards. Contradictions
                            are not silently overwritten — they are routed to a "disputed" lifecycle state
                            and queued for human review. Evidence-weighted conflict resolution is used
                            when the contradiction is minor; strong conflicts always require human sign-off.
                        </p>
                    </div>
                </div>
            </div>
        </TextBox>
    </Scene>
);
