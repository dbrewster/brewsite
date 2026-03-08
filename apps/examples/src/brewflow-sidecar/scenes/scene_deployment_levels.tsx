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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDeploymentLevels: JSX.Element = (
  <Scene key="bf-levels" id="bf-levels">
    <ProgressManager scrollUnits={3000} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bf-levels">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bf-levels">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bf-levels">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 26]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bf-levels" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={.7} theme={brewflowTheme}>
      <Diagram id="levels-diagram">
        <FlowLayout direction="top-down" gap={2} />

        <DiagramNode
          id="lvl-0"
          label="Level 0 — Passive"
          sublabel="Run brewflow-bridge · full episodic audit trail · zero agent behavior change"
          size={[14, 2.8]}
          color="#0f1820"
        />
        <DiagramNode
          id="lvl-1"
          label="Level 1 — Learning"
          sublabel="+ Run brewflow-dreamer · Neocortex accumulates silently · still no agent behavior change"
          size={[14, 2.8]}
          color="#101a25"
        />
        <DiagramNode
          id="lvl-2"
          label="Level 2 — Injection"
          sublabel="+ pre-task hook · agents start with constraints, procedures, pitfalls · first behavior change"
          size={[14, 2.8]}
          color="#111d2a"
          glow={{ intensity: 0.08 }}
        />
        <DiagramNode
          id="lvl-3"
          label="Level 3 — Recording"
          sublabel="+ post-task + session-end hooks · evidence accumulates · Neocortex improves continuously"
          size={[14, 2.8]}
          color="#121f2e"
        />
        <DiagramNode
          id="lvl-4"
          label="Level 4 — Recall"
          sublabel="+ MCP server + queen recall() · queen passes Neocortex context to workers in task instructions"
          size={[14, 2.8]}
          color="#132232"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="lvl-5"
          label="Level 5 — Full Loop"
          sublabel="+ agents use store/log_outcome/checkpoint · agents explicitly contribute to and consume memory"
          size={[14, 2.8]}
          color="#14253a"
          glow={{ intensity: 0.14 }}
        />

        <DiagramEdge from="lvl-0" to="lvl-1" arrowEnd="open" flow="forward" color="#5070b0" />
        <DiagramEdge from="lvl-1" to="lvl-2" arrowEnd="open" flow="forward" color="#5070b0" />
        <DiagramEdge from="lvl-2" to="lvl-3" arrowEnd="open" flow="forward" color="#5070b0" />
        <DiagramEdge from="lvl-3" to="lvl-4" arrowEnd="open" flow="forward" color="#5070b0" />
        <DiagramEdge from="lvl-4" to="lvl-5" arrowEnd="open" flow="forward" color="#5070b0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="levels-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE ADDITIVE GRADIENT
        </div>
        <p style={{ fontSize: '18px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.7, margin: '0 0 16px', maxWidth: 800 }}>
          Each level adds capability without breaking the levels below. Start at Level 0 with a single
          process and zero configuration changes to agents. Add levels incrementally as confidence grows.
        </p>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 8px' }}>
          Nothing breaks at any level if a higher level is absent.
        </p>
        <p style={{ fontSize: '15px', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.6, margin: 0 }}>
          A Level 3 deployment with the MCP server down degrades gracefully to Level 2 behavior —
          agents still receive context from the pre-task hook. A Level 5 deployment with dreamer
          disabled retains all episodic captures and can be back-filled later.
        </p>
      </div>
    </TextBox>
  </Scene>
);
