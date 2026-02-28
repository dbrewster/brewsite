// Widget setup for the LLM Filter example page.
// Must mirror the node topology in scene_llm_filter.tsx so the initial render
// is correct (no pop from placeholder → compiled state).

import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import {
  DiagramCanvasWidget,
  compileCanvas,
  compileDiagram,
  registerDiagramHandlers,
  darkGlassTheme,
} from '@brewsite/diagram';

const C_FE = '#1e3a5f'; const C_BE = '#162d48'; const C_AI = '#0f2820';
const C_APP = '#1e2e50'; const C_CLIENT = '#1a2845'; const C_API = '#1a3a78';
const C_CON = '#1a2832'; const C_INF = '#2e1f3a'; const C_OUT = '#2e1a18';
const C_CONV = '#1a3228'; const C_LLM = '#0f221a';
const S: [number, number] = [3.5, 1.3];

export const createLlmWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();
  const registry = createDefaultWidgetRegistry(manifest);

  const canvas = compileCanvas({ id: 'llm-canvas' }, [
    compileDiagram({
      id: 'llm-filter',
      layout: { kind: 'manual' },
      pivot: 'center',
      theme: darkGlassTheme,
      nodes: [
        // LLM frontends
        { id: 'chatgpt-fe', label: 'ChatGPT FrontEnd',  shape: 'flow:rounded', color: C_FE, position: [-10, 14.5, 0], size: S },
        { id: 'ms-word',    label: 'Microsoft Word',    shape: 'flow:rounded', color: C_FE, position: [0,   14.5, 0], size: S },
        { id: 'google-fe',  label: 'Google',            shape: 'flow:rounded', color: C_FE, position: [10,  14.5, 0], size: S },
        // LLM backends
        { id: 'chatgpt-be', label: 'ChatGPT Backend',   shape: 'flow:rounded', color: C_BE, position: [-10, 11.5, 0], size: S },
        { id: 'ms-be',      label: 'Microsoft Backend', shape: 'flow:rounded', color: C_BE, position: [0,   11.5, 0], size: S },
        { id: 'google-be',  label: 'Google Backend',    shape: 'flow:rounded', color: C_BE, position: [10,  11.5, 0], size: S },
        // AI providers
        { id: 'openai-a',   label: 'OpenAI', shape: 'flow:rounded', color: C_AI, position: [-10, 8.5, 0], size: S },
        { id: 'openai-b',   label: 'OpenAI', shape: 'flow:rounded', color: C_AI, position: [0,   8.5, 0], size: S },
        { id: 'gemini',     label: 'Gemini', shape: 'flow:rounded', color: C_AI, position: [10,  8.5, 0], size: S },
        // People
        { id: 'users', label: 'Users', shape: 'flow:actor', position: [8,   5.5, 0] },
        { id: 'admin', label: 'Admin', shape: 'flow:actor', position: [-22, 0.5, 0] },
        // App layer
        { id: 'enterprise', label: 'Enterprise Application', shape: 'flow:rounded', color: C_APP, position: [-7.5, 3.5, 0], size: S },
        { id: 'tool',       label: 'Tool',                   shape: 'flow:rounded', color: C_APP, position: [-2.5, 3.5, 0], size: S },
        { id: 'llm-mid',    label: 'LLM',                    shape: 'flow:rounded', color: C_APP, position: [2.5,  3.5, 0], size: S },
        { id: 'mcp',        label: 'MCP Server',             shape: 'flow:rounded', color: C_APP, position: [7.5,  3.5, 0], size: S },
        { id: 'agents',     label: 'Agents',                 shape: 'flow:rounded', color: C_APP, position: [12.5, 3.5, 0], size: S },
        // Client layer
        { id: 'witness',     label: 'Witness Anywhere',      shape: 'flow:rounded', color: C_CLIENT, position: [-7.5, 1, 0],  size: S },
        { id: 'chat',        label: 'Chat Client',           shape: 'flow:rounded', color: C_CLIENT, position: [-2.5, 1, 0],  size: S },
        { id: 'connector',   label: 'Connector',             shape: 'flow:rounded', color: C_CLIENT, position: [2.5,  1, 0],  size: S },
        { id: 'endpoint-ag', label: 'Endpoint Agent',        shape: 'flow:rounded', color: C_CLIENT, position: [7.5,  1, 0],  size: S },
        { id: 'third-party', label: '3rd party application', shape: 'flow:rounded', color: C_CLIENT, position: [12.5, 1, 0],  size: S },
        // API bar
        { id: 'api', label: 'API', shape: 'flow:rounded', color: C_API, position: [2.5, -2.5, 0], size: [22, 1.4], depth: 0.45 },
        // Console group members
        { id: 'con-dashboard',  label: 'Dashboard',             shape: 'flow:rounded', color: C_CON, position: [-15,   -4.5,  0], size: S, groupId: 'console' },
        { id: 'con-policy',     label: 'Policy Engine',         shape: 'flow:rounded', color: C_CON, position: [-20,   -6.5,  0], size: S, groupId: 'console' },
        { id: 'con-observ',     label: 'Observability',         shape: 'flow:rounded', color: C_CON, position: [-15.5, -6.5,  0], size: S, groupId: 'console' },
        { id: 'con-compliance', label: 'Compliance',            shape: 'flow:rounded', color: C_CON, position: [-11,   -6.5,  0], size: S, groupId: 'console' },
        { id: 'con-audit',      label: 'Audit',                 shape: 'flow:rounded', color: C_CON, position: [-21,   -8.5,  0], size: S, groupId: 'console' },
        { id: 'con-best-prac',  label: 'Best Practices',        shape: 'flow:rounded', color: C_CON, position: [-17,   -8.5,  0], size: S, groupId: 'console' },
        { id: 'con-logging',    label: 'Logging',               shape: 'flow:rounded', color: C_CON, position: [-13,   -8.5,  0], size: S, groupId: 'console' },
        { id: 'con-risk',       label: 'Risk Scoring',          shape: 'flow:rounded', color: C_CON, position: [-9,    -8.5,  0], size: S, groupId: 'console' },
        { id: 'con-tracker',    label: '3rd Party AI Tracker',  shape: 'flow:rounded', color: C_CON, position: [-21,   -10.5, 0], size: S, groupId: 'console' },
        { id: 'con-rec-eng',    label: 'Recommendation Engine', shape: 'flow:rounded', color: C_CON, position: [-17,   -10.5, 0], size: S, groupId: 'console' },
        { id: 'con-reporting',  label: 'Reporting',             shape: 'flow:rounded', color: C_CON, position: [-13,   -10.5, 0], size: S, groupId: 'console' },
        { id: 'con-alerting',   label: 'Alerting',              shape: 'flow:rounded', color: C_CON, position: [-9,    -10.5, 0], size: S, groupId: 'console' },
        // Input Filters group members
        { id: 'if-anon',        label: 'Anonymization',   shape: 'flow:rounded', color: C_INF, position: [-5.5, -4.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-p-inject',    label: 'Prompt Injection', shape: 'flow:rounded', color: C_INF, position: [-1.5, -4.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-halluc',      label: 'Hallucination',   shape: 'flow:rounded', color: C_INF, position: [2.5,  -4.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-model-drift', label: 'Model Drift',     shape: 'flow:rounded', color: C_INF, position: [6.5,  -4.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-pii',         label: 'PII Leakage',     shape: 'flow:rounded', color: C_INF, position: [-5.5, -6.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-sentiment',   label: 'Sentiment',       shape: 'flow:rounded', color: C_INF, position: [-1.5, -6.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-ban-topics',  label: 'Banned Topics',   shape: 'flow:rounded', color: C_INF, position: [2.5,  -6.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-bias',        label: 'Bias',            shape: 'flow:rounded', color: C_INF, position: [6.5,  -6.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-code',        label: 'Code',            shape: 'flow:rounded', color: C_INF, position: [-5.5, -8.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-toxicity',    label: 'Toxicity',        shape: 'flow:rounded', color: C_INF, position: [-1.5, -8.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-src-tag',     label: 'Source Tagging',  shape: 'flow:rounded', color: C_INF, position: [2.5,  -8.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-use-cases',   label: 'Use Cases',       shape: 'flow:rounded', color: C_INF, position: [6.5,  -8.5,  0], size: S, groupId: 'input-filters' },
        { id: 'if-ban-str',     label: 'Banned Strings',  shape: 'flow:rounded', color: C_INF, position: [-5.5, -10.5, 0], size: S, groupId: 'input-filters' },
        { id: 'if-tok-count',   label: 'Token Count',     shape: 'flow:rounded', color: C_INF, position: [-1.5, -10.5, 0], size: S, groupId: 'input-filters' },
        { id: 'if-encrypt',     label: 'Encryption',      shape: 'flow:rounded', color: C_INF, position: [2.5,  -10.5, 0], size: S, groupId: 'input-filters' },
        { id: 'if-observ',      label: 'Observability',   shape: 'flow:rounded', color: C_INF, position: [6.5,  -10.5, 0], size: S, groupId: 'input-filters' },
        // Output Filters group members
        { id: 'of-deanon',      label: 'DeAnonymize',     shape: 'flow:rounded', color: C_OUT, position: [10,   -4.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-p-inject',    label: 'Prompt Injection', shape: 'flow:rounded', color: C_OUT, position: [14,   -4.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-mal-urls',    label: 'Malicious URLs',  shape: 'flow:rounded', color: C_OUT, position: [18,   -4.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-code',        label: 'Code',            shape: 'flow:rounded', color: C_OUT, position: [22,   -4.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-model-drift', label: 'Model Drift',     shape: 'flow:rounded', color: C_OUT, position: [26,   -4.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-refutation',  label: 'Refutation',      shape: 'flow:rounded', color: C_OUT, position: [10,   -6.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-ban-topics',  label: 'Banned Topics',   shape: 'flow:rounded', color: C_OUT, position: [14,   -6.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-relevance',   label: 'Relevance',       shape: 'flow:rounded', color: C_OUT, position: [18,   -6.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-ban-str',     label: 'Banned Strings',  shape: 'flow:rounded', color: C_OUT, position: [22,   -6.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-bias',        label: 'Bias',            shape: 'flow:rounded', color: C_OUT, position: [26,   -6.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-halluc',      label: 'Hallucination',   shape: 'flow:rounded', color: C_OUT, position: [10,   -8.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-sensitive',   label: 'Sensitive',       shape: 'flow:rounded', color: C_OUT, position: [14,   -8.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-fact-check',  label: 'Fact Checking',   shape: 'flow:rounded', color: C_OUT, position: [18,   -8.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-on-topic',    label: 'On Topic',        shape: 'flow:rounded', color: C_OUT, position: [22,   -8.5,  0], size: S, groupId: 'output-filters' },
        { id: 'of-toxicity',    label: 'Toxicity',        shape: 'flow:rounded', color: C_OUT, position: [10,   -10.5, 0], size: S, groupId: 'output-filters' },
        { id: 'of-access-ctrl', label: 'Access Control',  shape: 'flow:rounded', color: C_OUT, position: [14,   -10.5, 0], size: S, groupId: 'output-filters' },
        { id: 'of-regex',       label: 'Regex',           shape: 'flow:rounded', color: C_OUT, position: [18,   -10.5, 0], size: S, groupId: 'output-filters' },
        { id: 'of-decrypt',     label: 'Decryption',      shape: 'flow:rounded', color: C_OUT, position: [22,   -10.5, 0], size: S, groupId: 'output-filters' },
        // Wide bars
        { id: 'llm-conv', label: 'LLM Converter',                  shape: 'flow:rounded', color: C_CONV, position: [2, -13, 0],  size: [46, 1.4], depth: 0.45 },
        { id: 'llm-main', label: 'LLM (public, private, etc.)',    shape: 'flow:rounded', color: C_LLM,  position: [2, -16, 0],  size: [46, 2.2], depth: 0.6  },
      ],
      edges: [
        { from: 'chatgpt-fe', to: 'chatgpt-be' }, { from: 'chatgpt-be', to: 'openai-a' },
        { from: 'ms-word',    to: 'ms-be' },       { from: 'ms-be',      to: 'openai-b' },
        { from: 'google-fe',  to: 'google-be' },   { from: 'google-be',  to: 'gemini' },
        { from: 'users',       to: 'enterprise' },
        { from: 'enterprise',  to: 'witness' },
        { from: 'chat',        to: 'api' },
        { from: 'connector',   to: 'api' },
        { from: 'witness',     to: 'api' },
        { from: 'endpoint-ag', to: 'api', arrowStart: 'open', arrowEnd: 'open' },
        { from: 'third-party', to: 'api', arrowStart: 'open', arrowEnd: 'open' },
        { from: 'admin', to: 'con-dashboard', arrowStart: 'open', arrowEnd: 'open' },
        { from: 'api', to: 'if-anon',       flow: 'forward', color: '#6a3a9a' },
        { from: 'api', to: 'of-deanon',     flow: 'forward', color: '#9a4a3a' },
        { from: 'api', to: 'con-dashboard',  style: 'dashed', color: '#3a6a7a' },
        { from: 'api',      to: 'llm-conv', flow: 'forward', color: '#2a5a88' },
        { from: 'llm-conv', to: 'llm-main', flow: 'forward', color: '#2a6a48' },
        { from: 'openai-a', to: 'llm-main', style: 'dashed', color: '#3a6a50' },
        { from: 'openai-b', to: 'llm-main', style: 'dashed', color: '#3a6a50' },
        { from: 'gemini',   to: 'llm-main', style: 'dashed', color: '#2a5a6a' },
      ],
      groups: [
        { id: 'console',        label: 'Console',        variant: 'boundary', color: '#1a2832', borderColor: '#2a5060', nodeIds: ['con-dashboard','con-policy','con-observ','con-compliance','con-audit','con-best-prac','con-logging','con-risk','con-tracker','con-rec-eng','con-reporting','con-alerting'] },
        { id: 'input-filters',  label: 'Input Filters',  variant: 'boundary', color: '#2e1f3a', borderColor: '#5a3a7a', nodeIds: ['if-anon','if-p-inject','if-halluc','if-model-drift','if-pii','if-sentiment','if-ban-topics','if-bias','if-code','if-toxicity','if-src-tag','if-use-cases','if-ban-str','if-tok-count','if-encrypt','if-observ'] },
        { id: 'output-filters', label: 'Output Filters', variant: 'boundary', color: '#2e1a18', borderColor: '#7a3a30', nodeIds: ['of-deanon','of-p-inject','of-mal-urls','of-code','of-model-drift','of-refutation','of-ban-topics','of-relevance','of-ban-str','of-bias','of-halluc','of-sensitive','of-fact-check','of-on-topic','of-toxicity','of-access-ctrl','of-regex','of-decrypt'] },
      ],
    }, darkGlassTheme),
  ], []);

  registry.register(new DiagramCanvasWidget('llm-canvas', canvas));
  return registry;
};
