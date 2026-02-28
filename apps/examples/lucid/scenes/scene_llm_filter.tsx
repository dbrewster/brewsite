// LLM Filter architecture diagram.
// Layout strategy:
//   • users / app-layer / client-layer — explicit positions (manually authored top tier)
//   • api, filters section, llm-conv, llm-main — hierarchical auto-layout
//   • console / input-filters / output-filters — grid auto-layout inside the filters container
//
// Vertical chain: client-layer → api → filters → llm-conv → llm-main
// The edge  filters → llm-conv  (instead of api → llm-conv) places llm-conv one
// hierarchical level below the filters block so the three sections never share a row.

import {Background, Environment, EnvironmentCube, Floor, FloorMirror, PinchMap, SceneDefinition} from '@brewsite/core';
import {Ambient, Camera, Directional, Lighting, Scene} from '@brewsite/core';
import { Action, InputController, KeyMap, PointerMap, WheelMap } from '@brewsite/core';
import {
  darkGlassTheme,
  Diagram,
  DiagramCanvas,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  GridLayout,
  HierarchicalLayout,
} from '@brewsite/diagram';
import {makeCubeUrls, skyEnvironment} from "../../meeting/scenes/sceneAssets";

const svgGradient = (id: string, stops: Array<[number, string]>, overlay?: string) => {
  const gradient = stops
    .map(([offset, color]) => `<stop offset=\"${offset}%\" stop-color=\"${color}\"/>`)
    .join('');
  const overlayLayer = overlay
    ? `<rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"${overlay}\"/>`
    : '';
  const svg = `
    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 800\">
      <defs>
        <linearGradient id=\"${id}\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">
          ${gradient}
        </linearGradient>
        <radialGradient id=\"${id}-glow\" cx=\"0.7\" cy=\"0.2\" r=\"0.6\">
          <stop offset=\"0%\" stop-color=\"#ffffff\" stop-opacity=\"0.25\"/>
          <stop offset=\"100%\" stop-color=\"#ffffff\" stop-opacity=\"0\"/>
        </radialGradient>
      </defs>
      <rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"url(#${id})\"/>
      ${overlayLayer}
      <rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"url(#${id}-glow)\"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const svgSolid = (color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect x="0" y="0" width="1200" height="800" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
// ─── Design tokens ────────────────────────────────────────────────────────────
export const backgrounds = {
  intro: svgGradient('intro', [
    [0, '#05060c'],
    [40, '#1f1224'],
    [100, '#ab2b45'],
  ]),
  reveal: svgGradient('reveal', [
    [0, '#f78a1c'],
    [45, '#ba5f3b'],
    [100, '#f78a1c'],
  ], 'rgba(20, 40, 70, 0.25)'),
  focus: svgGradient('focus', [
    [0, '#0b111a'],
    [50, '#11af2b'],
    [100, '#1aad4d'],
  ]),
  scan: svgGradient('scan', [
    [0, '#171a1f'],
    [50, '#5a5f69'],
    [100, '#21262d'],
  ], 'rgba(150, 150, 150, 0.18)'),

  outro: svgGradient('outro', [
    [0, '#020205'],
    [50, '#020205'],
    [100, '#020205'],
  ]),
  black: svgSolid('#000000'),
};

const C_APP    = '#4e4e1e';  // App tier
const C_CLIENT = '#1a2845';  // Client tier
const C_API    = '#1a3a78';  // API bar — prominent accent
const C_CON    = '#1a2832';  // Console nodes
const C_INF    = '#2e1f3a';  // Input filter nodes
const C_OUT    = '#2e1a18';  // Output filter nodes
const C_CONV   = '#1a3228';  // LLM Converter bar
const C_LLM    = '#0f221a';  // LLM main bar

const S: [number, number] = [3.5, 1.3]; // standard node size
const IS = 0.38;                         // icon scale for small nodes

export const sceneLlmFilter: SceneDefinition = {
  id: 'llm-filter',
  index: 0,
  getFrame: () => (
    <Scene id="llm-filter">
      <Camera
        mode="world"
        fov={55}
        position={[0, 5, 55]}
        target={[0, 0, 0]}
      />
      <InputController id="main" scope="canvas">
        <Action id="pinch-out-zoom" type="camera.dolly" cameraId="camera" speed={1}>
          <PinchMap direction="out" threshold={1} />
        </Action>

        <Action id="pinch-in-zoom" type="camera.dolly" cameraId="camera" speed={1}>
          <PinchMap direction="in" threshold={1} />
        </Action>
        <Action id="orbit-camera" type="camera.orbit" cameraId="camera" speed={1}>
          <PointerMap drag button="left" modifiers={['ctrl', 'shift']} axis="xy" />
          <PointerMap drag button="left" modifiers={['meta', 'shift']} axis="xy" />
          <WheelMap modifiers={['meta', 'shift']} axis="xy" />
        </Action>
        <Action id="dolly-camera" type="camera.dolly" cameraId="camera" speed={1}>
          <PointerMap drag button="left" modifiers={['alt']} axis="y" />
          <WheelMap modifiers={['alt']} axis="y" />
        </Action>
        <Action id="move-canvas" type="diagram-canvas.move" canvasId="llm-canvas" speed={1}>
          <PointerMap drag button="left" modifiers={['shift']} axis="xy" lockAxis="sticky" />
          <WheelMap axis="xy" />
        </Action>
        <Action id="rotate-canvas" type="diagram-canvas.rotate" canvasId="llm-canvas" speed={1}>
          <PointerMap drag button="left" modifiers={['ctrl']} axis="y" />
          <PointerMap drag button="left" modifiers={['meta']} axis="y" />
          <WheelMap modifiers={['meta']} axis="y" />
        </Action>
        <Action id="focus-canvas" type="diagram-canvas.focus" canvasId="llm-canvas">
          <PointerMap click button="left" modifiers={['meta']} />
        </Action>
        <Action id="reset-camera" type="camera.reset" cameraId="camera">
          <KeyMap key="1" modifiers={['ctrl']} />
          <KeyMap key="1" modifiers={['meta']} />
        </Action>
        <Action id="reset-canvas" type="diagram-canvas.reset" canvasId="llm-canvas">
          <KeyMap key="1" modifiers={['ctrl']} />
          <KeyMap key="1" modifiers={['meta']} />
        </Action>
        <Action id="scene-next" type="scene.next" stepScenes={1}>
          <KeyMap key="ArrowRight" />
          <KeyMap key="ArrowDown" />
        </Action>
        <Action id="scene-prev" type="scene.prev" stepScenes={1}>
          <KeyMap key="ArrowLeft" />
          <KeyMap key="ArrowUp" />
        </Action>
      </InputController>
      <Background imageUrl={backgrounds.black} opacity={1} cssSize="cover" cssPosition="center" />
      <Floor enabled position={[0, -10, 0]} scale={4}>
        <FloorMirror
          mirrorColor="#ffffff"
          mirrorOpacity={.3}
          mirrorResolution={2048}
          mirrorClipBias={0.001}
          mirrorEnvironmentIntensity={1}
          mirrorUseEnvironmentBackground
        />
      </Floor>
      <Lighting intensityScale={1}>
        <Ambient intensity={1.0} color="#ffffff"/>
        <Directional intensity={.8}  color="#b0ccff" position={[10, 40, 0]}/>
        <Directional intensity={1.2} color="#b0ccff" position={[20, 40, 0]}/>
        <Directional intensity={0.5} color="#ffe0b0" position={[0, -30, 0]}/>
      </Lighting>

      <DiagramCanvas id="llm-canvas" rotation={[0, 0, 0]} position={[0, 11, -10]} theme={darkGlassTheme} focusCenter={[0, 10, 0]}>
        <Diagram id="llm-filter" pivot="center">
          <HierarchicalLayout spacing={[1, 1.5]} />
          {/* ── Top tier: explicit positions ─────────────────────────────── */}
          <DiagramNode id="admin" label="Admin"
                       icon="ui:identification"
                       shape='circle' size={[4, 4]}
          />
          <DiagramNode id="users" label="Users"
                       icon="ui:users" iconScale={.5}
                       shape='octagon' size={[4,4]}
                       />

          {/* app-layer — explicit; allExplicit=true pins the synthetic block */}
          <DiagramGroup id="app-layer" color={C_APP} variant="boundary">
            <DiagramNode id="enterprise" label="Enterprise Application"
                         icon="ui:building-office-2" iconScale={IS}
                         color={C_APP} position={[-7.5, 3.5, 0]} size={S}/>
            <DiagramNode id="tool" label="Tool"
                         icon="ui:wrench-screwdriver" iconScale={IS}
                         color={C_APP} position={[-2.5, 3.5, 0]} size={S}/>
            <DiagramNode id="llm-mid" label="LLM"
                         icon="ui:cpu-chip" iconScale={IS}
                         color={C_APP} position={[2.5, 3.5, 0]} size={S}/>
            <DiagramNode id="mcp" label="MCP Server"
                         icon="ui:server" iconScale={IS}
                         color={C_APP} position={[7.5, 3.5, 0]} size={S}/>
            <DiagramNode id="agents" label="Agents"
                         icon="ui:squares-2x2" iconScale={IS}
                         color={C_APP} position={[12.5, 3.5, 0]} size={S}/>
          </DiagramGroup>

          {/* client-layer — explicit */}
          <DiagramGroup id="client-layer" variant="boundary">
            <DiagramNode id="witness" label="Witness Anywhere"
                         icon="ui:eye" iconScale={IS}
                         color={C_CLIENT} position={[-7.5, -1.3, 0]} size={S}/>
            <DiagramNode id="chat" label="Chat Client"
                         icon="ui:chat-bubble-left-right" iconScale={IS}
                         color={C_CLIENT} position={[-2.5, -1.3, 0]} size={S}/>
            <DiagramNode id="connector" label="Connector"
                         icon="ui:arrows-right-left" iconScale={IS}
                         color={C_CLIENT} position={[2.5, -1.3, 0]} size={S}/>
            <DiagramNode id="endpoint-ag" label="Endpoint Agent"
                         icon="ui:computer-desktop" iconScale={IS}
                         color={C_CLIENT} position={[7.5, -1.3, 0]} size={S}/>
            <DiagramNode id="third-party" label="3rd party application"
                         icon="ui:puzzle-piece" iconScale={IS}
                         color={C_CLIENT} position={[12.5, -1.3, 0]} size={S}/>
          </DiagramGroup>

          {/* ── Auto-placed: api → filters → llm-conv → llm-main ─────────── */}

          <DiagramNode id="api" label="API"
                       icon="ui:code-bracket" iconScale={0.28}
                       color={C_API} size={[22, 1.4]} depth={0.45}/>

          {/* filters container — arranges 3 child groups horizontally */}
          <DiagramGroup id="filters" variant="container">
            <GridLayout columns={3} />
            {/* console — grid layout, 4 columns, no explicit node positions */}
            <DiagramGroup id="console" label="Console"
                          variant="boundary" color="#1a2832" borderColor="#2a5060">
              <GridLayout columns={4} />
              <DiagramNode id="con-dashboard"  label="Dashboard"             icon="ui:presentation-chart-bar"  iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-policy"     label="Policy Engine"         icon="ui:document-text"           iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-observ"     label="Observability"         icon="ui:chart-bar"               iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-compliance" label="Compliance"            icon="ui:check-circle"            iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-audit"      label="Audit"                 icon="ui:clipboard"               iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-best-prac"  label="Best Practices"        icon="ui:academic-cap"            iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-logging"    label="Logging"               icon="ui:document-chart-bar"      iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-risk"       label="Risk Scoring"          icon="ui:exclamation-triangle"    iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-tracker"    label="3rd Party AI Tracker"  icon="ui:magnifying-glass"        iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-rec-eng"    label="Recommendation Engine" icon="ui:light-bulb"              iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-reporting"  label="Reporting"             icon="ui:presentation-chart-line" iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-alerting"   label="Alerting"              icon="ui:bell"                    iconScale={IS} color={C_CON} size={S}/>
            </DiagramGroup>

            {/* input-filters — grid layout */}
            <DiagramGroup id="input-filters" label="Input Filters"
                          variant="boundary" color="#2e1f3a" borderColor="#5a3a7a">
              <GridLayout columns={4}/>
              <DiagramNode id="if-anon"        label="Anonymization"   icon="ui:eye-slash"              iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-p-inject"    label="Prompt Injection" icon="ui:bug-ant"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-halluc"      label="Hallucination"   icon="ui:exclamation-triangle"   iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-model-drift" label="Model Drift"     icon="ui:arrow-path"             iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-pii"         label="PII Leakage"     icon="ui:finger-print"           iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-sentiment"   label="Sentiment"       icon="ui:chart-bar-square"       iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-ban-topics"  label="Banned Topics"   icon="ui:x-circle"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-bias"        label="Bias"            icon="ui:adjustments-horizontal" iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-code"        label="Code"            icon="ui:code-bracket"           iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-toxicity"    label="Toxicity"        icon="ui:fire"                   iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-src-tag"     label="Source Tagging"  icon="ui:tag"                    iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-use-cases"   label="Use Cases"       icon="ui:bookmark"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-ban-str"     label="Banned Strings"  icon="ui:funnel"                 iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-tok-count"   label="Token Count"     icon="ui:chart-bar-square"       iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-encrypt"     label="Encryption"      icon="ui:lock-closed"            iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-observ"      label="Observability"   icon="ui:eye"                    iconScale={IS} color={C_INF} size={S}/>
            </DiagramGroup>

            {/* output-filters — grid layout */}
            <DiagramGroup id="output-filters" label="Output Filters"
                          variant="boundary" color="#2e1a18" borderColor="#7a3a30">
              <GridLayout  columns={5}/>
              <DiagramNode id="of-deanon"      label="DeAnonymize"     icon="ui:eye"                        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-p-inject"    label="Prompt Injection" icon="ui:bug-ant"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-mal-urls"    label="Malicious URLs"  icon="ui:shield-exclamation"         iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-code"        label="Code"            icon="ui:code-bracket"               iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-model-drift" label="Model Drift"     icon="ui:arrow-path"                 iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-refutation"  label="Refutation"      icon="ui:x-circle"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-ban-topics"  label="Banned Topics"   icon="ui:x-circle"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-relevance"   label="Relevance"       icon="ui:magnifying-glass"           iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-ban-str"     label="Banned Strings"  icon="ui:funnel"                     iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-bias"        label="Bias"            icon="ui:adjustments-horizontal"     iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-halluc"      label="Hallucination"   icon="ui:exclamation-circle"         iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-sensitive"   label="Sensitive"       icon="ui:lock-closed"                iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-fact-check"  label="Fact Checking"   icon="ui:document-magnifying-glass"  iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-on-topic"    label="On Topic"        icon="ui:check-circle"               iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-toxicity"    label="Toxicity"        icon="ui:fire"                       iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-access-ctrl" label="Access Control"  icon="ui:key"                        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-regex"       label="Regex"           icon="ui:code-bracket-square"        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-decrypt"     label="Decryption"      icon="ui:lock-open"                  iconScale={IS} color={C_OUT} size={S}/>
            </DiagramGroup>

          </DiagramGroup>

          <DiagramNode id="llm-conv" label="LLM Converter"
                       icon="data:transform" iconScale={0.28}
                       color={C_CONV} size={[46, 1.4]} depth={0.45}/>

          <DiagramNode id="llm-main" label="LLM (public, private, etc.)"
                       icon="ui:sparkles" iconScale={0.32}
                       color={C_LLM} size={[46, 2.2]} depth={0.6}/>

          {/* ── Edges ────────────────────────────────────────────────────── */}
          <DiagramEdge from="users"         to="app-layer" flow="forward" />
          <DiagramEdge from="app-layer"     to="client-layer" flow="forward"/>
          <DiagramEdge from="client-layer"  to="api" flow="forward"/>
          <DiagramEdge from="admin"         to="console" arrowStart="open" arrowEnd="open" flow="forward"/>

          <DiagramEdge from="console"       to="input-filters" flow="bidirectional" arrowStart="open" arrowEnd="open" />

          {/* api fans into both filter groups for edge visualisation */}
          <DiagramEdge from="api" to="input-filters"  flow="forward" color="#6a3a9a"/>
          <DiagramEdge from="api" to="output-filters" flow="backward" color="#9a4a3a" toPort='top'/>

          {/* filters → llm-conv forces llm-conv one level below the filter block */}
          <DiagramEdge from="input-filters"  to="llm-conv" flow="forward" color="#2a5a88" />
          <DiagramEdge from="output-filters"  to="llm-conv" flow="backward" color="#2a5a88" fromPort='bottom'/>
          <DiagramEdge from="llm-conv" to="llm-main" flow="forward" color="#2a6a48"/>

        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};

export interface LlmFilterHudContent {
  readonly tagline: string;
  readonly title: string;
  readonly description: string;
}

export const llmFilterSceneHudContent: LlmFilterHudContent = {
  tagline: 'LLM Governance Architecture',
  title: 'Policy-Aware Request and Response Control Plane',
  description: 'This scene maps the full lifecycle of an LLM interaction across client entry points, API mediation, governance filters, and model execution. It highlights where policy is enforced before inference, where output validation occurs after inference, and how operator tooling maintains continuous oversight of safety, compliance, observability, and risk.',
};

export const llmFilterGroupHudContent: Record<string, LlmFilterHudContent> = {
  'app-layer': {
    tagline: 'Application Surface',
    title: 'App Layer Orchestration',
    description: 'The app layer represents business-facing product surfaces and automation endpoints that originate AI requests. It standardizes how enterprise tools, model copilots, MCP services, and agents dispatch prompts into the governed stack, ensuring upstream clients enter a consistent policy envelope before model invocation.',
  },
  'client-layer': {
    tagline: 'Client Entry Tier',
    title: 'Client Layer Connectivity',
    description: 'The client layer captures the user and system interfaces that feed the platform: chat clients, connectors, endpoint agents, and third-party applications. This tier normalizes heterogeneous traffic into a common API ingress so downstream controls can apply uniform identity, routing, and governance behavior.',
  },
  'filters': {
    tagline: 'Governance Envelope',
    title: 'Centralized Filter Domain',
    description: 'The filters domain is the platform’s policy heart. It surrounds model calls with deterministic controls that inspect inbound prompts and outbound responses, enabling bidirectional safety guarantees. By unifying filter families behind one domain, policy authors can manage security, privacy, and quality controls as a coherent system.',
  },
  'console': {
    tagline: 'Operations and Oversight',
    title: 'Console Control Hub',
    description: 'The console group provides operator-facing governance tooling for policy lifecycle management and runtime accountability. Teams use it to author rules, inspect telemetry, review audit trails, score risk, and trigger alerts, turning model governance into an observable and continuously improvable operational process.',
  },
  'input-filters': {
    tagline: 'Pre-Inference Safeguards',
    title: 'Input Filter Guardrails',
    description: 'Input filters evaluate requests before they reach any model endpoint. They enforce controls such as anonymization, prompt injection defense, PII detection, topic restrictions, token constraints, and encryption hygiene. This stage reduces unsafe or non-compliant prompts early, shrinking downstream risk and improving model reliability.',
  },
  'output-filters': {
    tagline: 'Post-Inference Safeguards',
    title: 'Output Filter Enforcement',
    description: 'Output filters validate model responses before delivery to users or systems. They screen for hallucinations, sensitive leakage, policy violations, harmful content, and relevance issues, while enabling fact checks and access-control-aware release decisions. This final gate ensures responses remain safe, on-topic, and policy-compliant.',
  },
};
