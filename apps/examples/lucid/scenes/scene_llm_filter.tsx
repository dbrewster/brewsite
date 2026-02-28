// LLM Filter architecture diagram.
// Layout strategy:
//   • users / app-layer / client-layer — explicit positions (manually authored top tier)
//   • api, filters section, llm-conv, llm-main — hierarchical auto-layout
//   • console / input-filters / output-filters — grid auto-layout inside the filters container
//
// Vertical chain: client-layer → api → filters → llm-conv → llm-main
// The edge  filters → llm-conv  (instead of api → llm-conv) places llm-conv one
// hierarchical level below the filters block so the three sections never share a row.

import type {SceneDefinition} from '@brewsite/core';
import {Ambient, Camera, Directional, Lighting, Scene} from '@brewsite/core';
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

// ─── Design tokens ────────────────────────────────────────────────────────────
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
        position={[2, 0, 75]}
        target={[0, 0, 0]}
        interaction={{
          enabled: true,
          rotate: true,
          pan: { speed: 15 },
          zoom: { speed: 15 },
          wheelZoom: true,
        }}
      />
      <Lighting intensityScale={1}>
        <Ambient intensity={1.0} color="#ffffff"/>
        <Directional intensity={.8}  color="#b0ccff" position={[10, 40, 60]}/>
        <Directional intensity={1.2} color="#b0ccff" position={[20, 40, 20]}/>
        <Directional intensity={0.5} color="#ffe0b0" position={[0, -30, 20]}/>
      </Lighting>

      <DiagramCanvas id="llm-canvas" rotation={[-Math.PI / 10, 0, 0]} theme={darkGlassTheme}>
        <Diagram id="llm-filter" pivot="center">
          <HierarchicalLayout spacing={[1, 1]} />
          {/* ── Top tier: explicit positions ─────────────────────────────── */}
          <DiagramNode id="users" label="Users"
                       shape="ui:users" iconScale={0.55}
                       position={[8, 8.0, 0]}/>
          <DiagramNode id="admin" label="Admin"
                       shape="ui:identification" iconScale={0.55}
                       position={[-22, 0.5, 0]}/>

          {/* app-layer — explicit; allExplicit=true pins the synthetic block */}
          <DiagramGroup id="app-layer" color={C_APP} variant="boundary">
            <DiagramNode id="enterprise" label="Enterprise Application"
                         shape="ui:building-office-2" iconScale={IS}
                         color={C_APP} position={[-7.5, 3.5, 0]} size={S}/>
            <DiagramNode id="tool" label="Tool"
                         shape="ui:wrench-screwdriver" iconScale={IS}
                         color={C_APP} position={[-2.5, 3.5, 0]} size={S}/>
            <DiagramNode id="llm-mid" label="LLM"
                         shape="ui:cpu-chip" iconScale={IS}
                         color={C_APP} position={[2.5, 3.5, 0]} size={S}/>
            <DiagramNode id="mcp" label="MCP Server"
                         shape="ui:server" iconScale={IS}
                         color={C_APP} position={[7.5, 3.5, 0]} size={S}/>
            <DiagramNode id="agents" label="Agents"
                         shape="ui:squares-2x2" iconScale={IS}
                         color={C_APP} position={[12.5, 3.5, 0]} size={S}/>
          </DiagramGroup>

          {/* client-layer — explicit */}
          <DiagramGroup id="client-layer" variant="boundary">
            <DiagramNode id="witness" label="Witness Anywhere"
                         shape="ui:eye" iconScale={IS}
                         color={C_CLIENT} position={[-7.5, -1.3, 0]} size={S}/>
            <DiagramNode id="chat" label="Chat Client"
                         shape="ui:chat-bubble-left-right" iconScale={IS}
                         color={C_CLIENT} position={[-2.5, -1.3, 0]} size={S}/>
            <DiagramNode id="connector" label="Connector"
                         shape="ui:arrows-right-left" iconScale={IS}
                         color={C_CLIENT} position={[2.5, -1.3, 0]} size={S}/>
            <DiagramNode id="endpoint-ag" label="Endpoint Agent"
                         shape="ui:computer-desktop" iconScale={IS}
                         color={C_CLIENT} position={[7.5, -1.3, 0]} size={S}/>
            <DiagramNode id="third-party" label="3rd party application"
                         shape="ui:puzzle-piece" iconScale={IS}
                         color={C_CLIENT} position={[12.5, -1.3, 0]} size={S}/>
          </DiagramGroup>

          {/* ── Auto-placed: api → filters → llm-conv → llm-main ─────────── */}

          <DiagramNode id="api" label="API"
                       shape="ui:code-bracket" iconScale={0.28}
                       color={C_API} size={[22, 1.4]} depth={0.45}/>

          {/* filters container — arranges 3 child groups horizontally */}
          <DiagramGroup id="filters" variant="container">
            <GridLayout columns={3} />
            {/* console — grid layout, 4 columns, no explicit node positions */}
            <DiagramGroup id="console" label="Console"
                          variant="boundary" color="#1a2832" borderColor="#2a5060">
              <GridLayout columns={4} />
              <DiagramNode id="con-dashboard"  label="Dashboard"             shape="ui:presentation-chart-bar"  iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-policy"     label="Policy Engine"         shape="ui:document-text"           iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-observ"     label="Observability"         shape="ui:chart-bar"               iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-compliance" label="Compliance"            shape="ui:check-circle"            iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-audit"      label="Audit"                 shape="ui:clipboard"               iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-best-prac"  label="Best Practices"        shape="ui:academic-cap"            iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-logging"    label="Logging"               shape="ui:document-chart-bar"      iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-risk"       label="Risk Scoring"          shape="ui:exclamation-triangle"    iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-tracker"    label="3rd Party AI Tracker"  shape="ui:magnifying-glass"        iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-rec-eng"    label="Recommendation Engine" shape="ui:light-bulb"              iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-reporting"  label="Reporting"             shape="ui:presentation-chart-line" iconScale={IS} color={C_CON} size={S}/>
              <DiagramNode id="con-alerting"   label="Alerting"              shape="ui:bell"                    iconScale={IS} color={C_CON} size={S}/>
            </DiagramGroup>

            {/* input-filters — grid layout */}
            <DiagramGroup id="input-filters" label="Input Filters"
                          variant="boundary" color="#2e1f3a" borderColor="#5a3a7a">
              <GridLayout columns={4}/>
              <DiagramNode id="if-anon"        label="Anonymization"   shape="ui:eye-slash"              iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-p-inject"    label="Prompt Injection" shape="ui:bug-ant"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-halluc"      label="Hallucination"   shape="ui:exclamation-triangle"   iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-model-drift" label="Model Drift"     shape="ui:arrow-path"             iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-pii"         label="PII Leakage"     shape="ui:finger-print"           iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-sentiment"   label="Sentiment"       shape="ui:chart-bar-square"       iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-ban-topics"  label="Banned Topics"   shape="ui:x-circle"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-bias"        label="Bias"            shape="ui:adjustments-horizontal" iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-code"        label="Code"            shape="ui:code-bracket"           iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-toxicity"    label="Toxicity"        shape="ui:fire"                   iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-src-tag"     label="Source Tagging"  shape="ui:tag"                    iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-use-cases"   label="Use Cases"       shape="ui:bookmark"               iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-ban-str"     label="Banned Strings"  shape="ui:funnel"                 iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-tok-count"   label="Token Count"     shape="ui:chart-bar-square"       iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-encrypt"     label="Encryption"      shape="ui:lock-closed"            iconScale={IS} color={C_INF} size={S}/>
              <DiagramNode id="if-observ"      label="Observability"   shape="ui:eye"                    iconScale={IS} color={C_INF} size={S}/>
            </DiagramGroup>

            {/* output-filters — grid layout */}
            <DiagramGroup id="output-filters" label="Output Filters"
                          variant="boundary" color="#2e1a18" borderColor="#7a3a30">
              <GridLayout  columns={5}/>
              <DiagramNode id="of-deanon"      label="DeAnonymize"     shape="ui:eye"                        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-p-inject"    label="Prompt Injection" shape="ui:bug-ant"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-mal-urls"    label="Malicious URLs"  shape="ui:shield-exclamation"         iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-code"        label="Code"            shape="ui:code-bracket"               iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-model-drift" label="Model Drift"     shape="ui:arrow-path"                 iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-refutation"  label="Refutation"      shape="ui:x-circle"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-ban-topics"  label="Banned Topics"   shape="ui:x-circle"                   iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-relevance"   label="Relevance"       shape="ui:magnifying-glass"           iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-ban-str"     label="Banned Strings"  shape="ui:funnel"                     iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-bias"        label="Bias"            shape="ui:adjustments-horizontal"     iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-halluc"      label="Hallucination"   shape="ui:exclamation-circle"         iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-sensitive"   label="Sensitive"       shape="ui:lock-closed"                iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-fact-check"  label="Fact Checking"   shape="ui:document-magnifying-glass"  iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-on-topic"    label="On Topic"        shape="ui:check-circle"               iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-toxicity"    label="Toxicity"        shape="ui:fire"                       iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-access-ctrl" label="Access Control"  shape="ui:key"                        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-regex"       label="Regex"           shape="ui:code-bracket-square"        iconScale={IS} color={C_OUT} size={S}/>
              <DiagramNode id="of-decrypt"     label="Decryption"      shape="ui:lock-open"                  iconScale={IS} color={C_OUT} size={S}/>
            </DiagramGroup>

          </DiagramGroup>

          <DiagramNode id="llm-conv" label="LLM Converter"
                       shape="data:transform" iconScale={0.28}
                       color={C_CONV} size={[46, 1.4]} depth={0.45}/>

          <DiagramNode id="llm-main" label="LLM (public, private, etc.)"
                       shape="ui:sparkles" iconScale={0.32}
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
