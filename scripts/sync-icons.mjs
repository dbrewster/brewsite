#!/usr/bin/env node
/**
 * sync-icons.mjs
 *
 * Populates apps/examples/public/assets/shapes/ from npm icon packages.
 *
 * Namespaces handled:
 *   ui:        Heroicons 24/solid (white fill)  → shapes/ui/
 *   tech:      Simple Icons          → shapes/tech/
 *   security:  Heroicons (remapped)  → shapes/security/
 *   data:      Heroicons (remapped)  → shapes/data/
 *   net:       Heroicons (remapped)  → shapes/net/
 *   aws:       Heroicons (remapped)  → shapes/aws/  (new services only — existing official icons are not overwritten)
 *   gcp:       Heroicons (remapped)  → shapes/gcp/  (new services only)
 *   azure:     Heroicons (remapped)  → shapes/azure/
 *
 * Run:  node scripts/sync-icons.mjs
 * Re-run safely: skips existing files unless --force flag is passed.
 * Force:        node scripts/sync-icons.mjs --force
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
// Use solid (filled) variant so THREE.SVGLoader receives filled paths.
// Outline icons use stroke-only paths which the renderer skips entirely.
const HEROICONS_DIR = resolve(ROOT, 'node_modules/heroicons/24/solid');
const SIMPLE_ICONS_DIR = resolve(ROOT, 'node_modules/simple-icons/icons');
const OUTPUT_DIR = resolve(ROOT, 'apps/examples/public/assets/shapes');

const FORCE = process.argv.includes('--force');
let copied = 0;
let skipped = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Write processed SVG content → dest/name.svg. Skips if dest exists and !FORCE. */
function writeSvg(content, destDir, destName) {
  const dest = resolve(destDir, `${destName}.svg`);
  if (!FORCE && existsSync(dest)) {
    skipped++;
    return;
  }
  writeFileSync(dest, content, 'utf8');
  copied++;
}

/**
 * Process a Heroicons solid SVG for THREE.SVGLoader compatibility.
 * Solid icons use fill="currentColor" which Three.js cannot resolve to a colour.
 * We replace it with an explicit white so icons render cleanly on dark nodes.
 */
function processHeroiconSvg(src) {
  let svg = readFileSync(src, 'utf8');
  // Replace every occurrence of currentColor (fill or stroke) with white.
  svg = svg.replace(/currentColor/g, '#ffffff');
  return svg;
}

/**
 * Process a Simple Icons SVG for THREE.SVGLoader compatibility.
 * Simple Icons have no explicit fill attribute; THREE.SVGLoader then sees
 * fill=undefined and skips the path.  We inject fill="#ffffff" onto the
 * root <svg> so paths inherit a parseable colour.
 */
function processSimpleIconSvg(src) {
  let svg = readFileSync(src, 'utf8');
  // Inject fill="#ffffff" into the opening <svg ...> tag if not already present.
  if (!svg.includes('fill=')) {
    svg = svg.replace(/^<svg /, '<svg fill="#ffffff" ');
  } else {
    // Replace any brand colour (e.g. simple-icons that embed fill="#hex") with white
    // so icons show up on the dark node background colour.
    svg = svg.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="#ffffff"');
  }
  return svg;
}

/** Copy and process a heroicon → destDir/destName.svg */
function heroicon(iconName, destDir, destName) {
  const src = resolve(HEROICONS_DIR, `${iconName}.svg`);
  if (!existsSync(src)) {
    console.warn(`  MISSING heroicon: ${iconName}`);
    return;
  }
  writeSvg(processHeroiconSvg(src), destDir, destName ?? iconName);
}

/** Copy and process a simple-icon → destDir/destName.svg */
function simpleIcon(slug, destDir, destName) {
  const src = resolve(SIMPLE_ICONS_DIR, `${slug}.svg`);
  if (!existsSync(src)) {
    console.warn(`  MISSING simple-icon: ${slug}`);
    return;
  }
  writeSvg(processSimpleIconSvg(src), destDir, destName);
}

// ─── ui: namespace — Heroicons 24/outline ────────────────────────────────────

/** All ui: icons. Array entries are heroicon filenames (= our ui:name). */
const UI_ICONS = [
  // Compute & Infrastructure
  'server', 'server-stack', 'cpu-chip', 'circle-stack', 'cloud',
  'cloud-arrow-up', 'cloud-arrow-down', 'signal', 'wifi', 'globe-alt',
  'globe-americas',
  // Users & Organisation
  'user', 'users', 'user-group', 'user-circle', 'identification',
  'building-office', 'building-office-2', 'home', 'map-pin', 'building-library',
  // Security
  'shield-check', 'shield-exclamation', 'lock-closed', 'lock-open', 'key',
  'finger-print', 'eye', 'eye-slash',
  // Data & Documents
  'folder', 'folder-open', 'document', 'document-text', 'document-chart-bar',
  'document-magnifying-glass', 'clipboard', 'table-cells', 'archive-box',
  'archive-box-arrow-down', 'inbox', 'inbox-stack',
  // Monitoring & Status
  'check-circle', 'x-circle', 'exclamation-circle', 'information-circle',
  'exclamation-triangle', 'chart-bar', 'chart-bar-square', 'chart-pie',
  'presentation-chart-bar', 'presentation-chart-line', 'fire', 'bolt',
  // Code & Dev
  'code-bracket', 'code-bracket-square', 'command-line', 'bug-ant', 'beaker',
  'wrench-screwdriver', 'puzzle-piece', 'squares-2x2', 'squares-plus',
  // Communication & Flow
  'chat-bubble-left', 'chat-bubble-left-right', 'envelope', 'phone', 'bell',
  'megaphone', 'rss', 'paper-airplane', 'microphone',
  // Actions & Navigation
  'arrow-path', 'arrow-path-rounded-square', 'arrows-right-left',
  'arrows-pointing-out', 'arrows-pointing-in',
  'cog-6-tooth', 'cog-8-tooth', 'adjustments-horizontal', 'adjustments-vertical',
  'magnifying-glass', 'funnel', 'tag', 'bookmark', 'wrench', 'language',
  // Finance
  'credit-card', 'banknotes', 'currency-dollar', 'shopping-cart',
  'receipt-percent', 'gift', 'flag', 'building-library',
  // Devices
  'computer-desktop', 'device-phone-mobile', 'device-tablet', 'printer',
  // Misc useful
  'academic-cap', 'light-bulb', 'trophy', 'heart', 'star', 'sparkles',
  'paint-brush', 'swatch', 'photo', 'film', 'musical-note',
];

// ─── tech: namespace — Simple Icons ─────────────────────────────────────────

/**
 * Maps our tech: name → simple-icons slug.
 * Slug is the filename in node_modules/simple-icons/icons/ (without .svg).
 */
const TECH_ICONS = {
  // Languages
  'typescript':      'typescript',
  'javascript':      'javascript',
  'python':          'python',
  'go':              'go',
  'rust':            'rust',
  'dotnet':          'dotnet',
  'ruby':            'ruby',
  'php':             'php',
  'swift':           'swift',
  'kotlin':          'kotlin',
  'scala':           'scala',
  'elixir':          'elixir',
  // Databases
  'postgresql':      'postgresql',
  'mysql':           'mysql',
  'mongodb':         'mongodb',
  'redis':           'redis',
  'elasticsearch':   'elasticsearch',
  'cassandra':       'apachecassandra',
  'sqlite':          'sqlite',
  'influxdb':        'influxdb',
  'neo4j':           'neo4j',
  'cockroachdb':     'cockroachlabs',
  'clickhouse':      'clickhouse',
  'snowflake':       'snowflake',
  // Message Queues & Streaming
  'kafka':           'apachekafka',
  'rabbitmq':        'rabbitmq',
  'nats':            'natsdotio',
  // CI/CD & GitOps
  'github':          'github',
  'gitlab':          'gitlab',
  'bitbucket':       'bitbucket',
  'jenkins':         'jenkins',
  'circleci':        'circleci',
  'github-actions':  'githubactions',
  'argocd':          'argo',
  'flux':            'flux',
  'drone':           'drone',
  // Containers & Infrastructure-as-Code
  'docker':          'docker',
  'kubernetes':      'kubernetes',
  'helm':            'helm',
  'terraform':       'terraform',
  'ansible':         'ansible',
  'pulumi':          'pulumi',
  'bun':             'bun',
  // Monitoring & Observability
  'prometheus':      'prometheus',
  'grafana':         'grafana',
  'datadog':         'datadog',
  'splunk':          'splunk',
  'elastic':         'elastic',
  'jaeger':          'jaeger',
  'opentelemetry':   'opentelemetry',
  'pagerduty':       'pagerduty',
  'opsgenie':        'opsgenie',
  // Web Frameworks & Runtimes
  'react':           'react',
  'nextjs':          'nextdotjs',
  'vue':             'vuedotjs',
  'nuxtjs':          'nuxt',
  'angular':         'angular',
  'svelte':          'svelte',
  'astro':           'astro',
  'remix':           'remix',
  'nodejs':          'nodedotjs',
  'deno':            'deno',
  'fastapi':         'fastapi',
  'django':          'django',
  'rails':           'rubyonrails',
  // Proxies, API & Networking
  'nginx':           'nginx',
  'apache':          'apache',
  'envoy':           'envoyproxy',
  'istio':           'istio',
  'kong':            'kong',
  'traefik':         'traefikproxy',
  // Auth & Identity
  'auth0':           'auth0',
  'keycloak':        'keycloak',
  'okta':            'okta',
  // AI/ML
  'huggingface':     'huggingface',
  'tensorflow':      'tensorflow',
  'pytorch':         'pytorch',
  'langchain':       'langchain',
  // Collaboration & Productivity
  'discord':         'discord',
  'jira':            'jira',
  'confluence':      'confluence',
  'figma':           'figma',
  'notion':          'notion',
};

// ─── security: namespace — Heroicons (semantic remapping) ────────────────────

const SECURITY_ICONS = {
  'shield':       'shield-check',
  'shield-alert': 'shield-exclamation',
  'lock':         'lock-closed',
  'unlock':       'lock-open',
  'key':          'key',
  'fingerprint':  'finger-print',
  'eye':          'eye',
  'eye-hidden':   'eye-slash',
  'certificate':  'identification',
  'audit':        'clipboard',
  'alert':        'exclamation-triangle',
  'mfa':          'finger-print',
  'vpn':          'globe-alt',
  'waf':          'shield-check',
  'ddos':         'bolt',
  'threat':       'fire',
  'incident':     'exclamation-circle',
  'scan':         'magnifying-glass',
  'token':        'key',
  'policy':       'document-text',
  'compliance':   'check-circle',
  'rbac':         'user-group',
  'sso':          'user-circle',
  'sandbox':      'squares-2x2',
  'encryption':   'lock-closed',
};

// ─── data: namespace — Heroicons (semantic remapping) ────────────────────────

const DATA_ICONS = {
  'pipeline':   'arrow-path',
  'stream':     'signal',
  'batch':      'archive-box',
  'warehouse':  'building-office-2',
  'lake':       'globe-americas',
  'etl':        'arrows-right-left',
  'transform':  'adjustments-horizontal',
  'aggregate':  'funnel',
  'schema':     'table-cells',
  'partition':  'squares-2x2',
  'query':      'magnifying-glass',
  'report':     'document-chart-bar',
  'dashboard':  'presentation-chart-bar',
  'event':      'bolt',
  'webhook':    'arrow-path-rounded-square',
  'api':        'code-bracket',
  'cdc':        'arrow-path',
  'lineage':    'chart-bar',
  'catalog':    'folder-open',
  'mart':       'circle-stack',
};

// ─── net: namespace — Heroicons (semantic remapping) ─────────────────────────

const NET_ICONS = {
  // Existing 7 (now get SVG assets)
  'router':        'arrows-right-left',
  'switch':        'squares-2x2',
  'firewall':      'shield-check',
  'load-balancer': 'adjustments-horizontal',
  'server':        'server',
  'desktop':       'computer-desktop',
  'mobile':        'device-phone-mobile',
  // New additions
  'dns':           'globe-alt',
  'vpn':           'lock-closed',
  'proxy':         'arrow-path',
  'nat':           'arrows-right-left',
  'rack':          'server-stack',
  'datacenter':    'building-office',
  'cluster':       'cpu-chip',
  'cdn-pop':       'signal',
  'wifi-ap':       'wifi',
  'segment':       'squares-plus',
  'packet':        'paper-airplane',
  'wan':           'globe-americas',
  'vlan':          'tag',
  'peering':       'users',
  'bgp':           'arrows-pointing-out',
  'private-link':  'key',
  'internet':      'globe-alt',
  'tablet':        'device-tablet',
};

// ─── aws: new services — Heroicons (do NOT overwrite existing official icons) ─

const AWS_NEW_ICONS = {
  // Compute
  'fargate':                  'cpu-chip',
  'lightsail':                'server',
  'batch':                    'archive-box',
  'app-runner':               'arrow-path',
  'outposts':                 'building-office',
  // Storage
  'efs':                      'folder',
  'fsx':                      'folder-open',
  'glacier':                  'archive-box',
  'backup':                   'archive-box-arrow-down',
  'storage-gateway':          'arrows-right-left',
  // Database
  'aurora':                   'circle-stack',
  'redshift':                 'circle-stack',
  'neptune':                  'circle-stack',
  'documentdb':               'document-text',
  'timestream':               'chart-bar',
  'keyspaces':                'table-cells',
  'qldb':                     'document-text',
  // Networking
  'route53':                  'globe-alt',
  'direct-connect':           'arrows-right-left',
  'transit-gateway':          'arrows-right-left',
  'waf':                      'shield-check',
  'shield-service':           'shield-check',
  'nat-gateway':              'arrows-right-left',
  'global-accelerator':       'globe-americas',
  'privatelink':              'lock-closed',
  // Integration
  'step-functions':           'arrow-path',
  'eventbridge':              'bolt',
  'msk':                      'signal',
  'kinesis':                  'signal',
  'appflow':                  'arrow-path',
  'mq':                       'chat-bubble-left',
  'appsync':                  'arrows-right-left',
  // Security
  'iam':                      'identification',
  'cognito':                  'user-circle',
  'kms':                      'key',
  'secrets-manager':          'lock-closed',
  'certificate-manager':      'identification',
  'guardduty':                'shield-exclamation',
  'security-hub':             'shield-check',
  'inspector':                'magnifying-glass',
  'macie':                    'eye',
  // Developer Tools
  'codepipeline':             'arrow-path',
  'codebuild':                'code-bracket',
  'codedeploy':               'arrow-path',
  'cloud9':                   'command-line',
  'x-ray':                    'magnifying-glass',
  'cloudwatch':               'chart-bar',
  'cloudtrail':               'document-text',
  'cloudformation':           'squares-2x2',
  'systems-manager':          'cog-6-tooth',
  'control-tower':            'building-office-2',
  'organizations':            'building-office-2',
  'amplify':                  'bolt',
  // Analytics
  'athena':                   'magnifying-glass',
  'glue':                     'arrows-right-left',
  'emr':                      'circle-stack',
  'quicksight':               'presentation-chart-bar',
  'lakeformation':            'globe-americas',
  'kinesis-data-analytics':   'chart-bar',
  'opensearch':               'magnifying-glass',
  'datazone':                 'folder-open',
  // AI/ML
  'sagemaker':                'beaker',
  'bedrock':                  'cpu-chip',
  'rekognition':              'eye',
  'polly':                    'megaphone',
  'transcribe':               'microphone',
  'translate':                'language',
  'comprehend':               'document-magnifying-glass',
  'textract':                 'document',
  // IoT
  'iot-core':                 'signal',
  'greengrass':               'cpu-chip',
  // Media
  'ivs':                      'film',
};

// ─── gcp: new services — Heroicons (do NOT overwrite existing official icons) ─

const GCP_NEW_ICONS = {
  'gke':                  'cpu-chip',
  'cloud-functions':      'bolt',
  'cloud-sql':            'circle-stack',
  'cloud-spanner':        'circle-stack',
  'firebase':             'fire',
  'firestore':            'document-text',
  'bigtable':             'table-cells',
  'dataflow':             'arrow-path',
  'dataproc':             'circle-stack',
  'vertex-ai':            'beaker',
  'cloud-build':          'code-bracket',
  'artifact-registry':    'archive-box',
  'cloud-dns':            'globe-alt',
  'cloud-armor':          'shield-check',
  'cloud-nat':            'arrows-right-left',
  'vpc-network':          'globe-alt',
  'load-balancing':       'adjustments-horizontal',
  'secret-manager':       'lock-closed',
  'iam':                  'identification',
  'cloud-monitoring':     'chart-bar',
  'cloud-logging':        'document-text',
  'cloud-trace':          'magnifying-glass',
  'memorystore':          'circle-stack',
  'workflows':            'arrow-path',
  'eventarc':             'bolt',
  'apigee':               'code-bracket',
  'cloud-cdn':            'signal',
  'looker':               'presentation-chart-bar',
  'alloydb':              'circle-stack',
  'datastream':           'signal',
  'dataform':             'arrows-right-left',
  'cloud-run-jobs':       'arrow-path',
  'cloud-scheduler':      'clock',
  'cloud-tasks':          'queue-list',
  'identity-platform':    'user-circle',
};

// ─── azure: namespace — Heroicons ────────────────────────────────────────────

const AZURE_ICONS = {
  // Compute
  'virtual-machine':          'server',
  'app-service':              'arrow-path',
  'functions':                'bolt',
  'aks':                      'cpu-chip',
  'container-instances':      'squares-2x2',
  'batch':                    'archive-box',
  'spring-apps':              'beaker',
  // Storage
  'storage-account':          'archive-box',
  'blob-storage':             'archive-box',
  'data-lake':                'globe-americas',
  'managed-disk':             'circle-stack',
  'files':                    'folder',
  // Database
  'sql-database':             'circle-stack',
  'cosmos-db':                'circle-stack',
  'cache-for-redis':          'bolt',
  'database-for-postgres':    'circle-stack',
  'synapse-analytics':        'chart-bar',
  'database-for-mysql':       'circle-stack',
  // Networking
  'virtual-network':          'globe-alt',
  'load-balancer':            'adjustments-horizontal',
  'application-gateway':      'adjustments-horizontal',
  'front-door':               'globe-americas',
  'cdn':                      'signal',
  'vpn-gateway':              'lock-closed',
  'firewall':                 'shield-check',
  'dns':                      'globe-alt',
  'private-link':             'key',
  'nat-gateway':              'arrows-right-left',
  // Integration
  'service-bus':              'chat-bubble-left',
  'event-hubs':               'bolt',
  'event-grid':               'bolt',
  'logic-apps':               'arrow-path',
  'api-management':           'code-bracket',
  'service-connector':        'arrows-right-left',
  // Security
  'active-directory':         'identification',
  'key-vault':                'key',
  'defender':                 'shield-exclamation',
  'sentinel':                 'shield-check',
  'ddos-protection':          'shield-check',
  // DevOps
  'devops':                   'code-bracket',
  'pipelines':                'arrow-path',
  'repos':                    'folder',
  'boards':                   'squares-2x2',
  // AI & ML
  'cognitive-services':       'beaker',
  'openai':                   'cpu-chip',
  'machine-learning':         'beaker',
  'bot-service':              'chat-bubble-left-right',
  // Management
  'monitor':                  'chart-bar',
  'policy':                   'document-text',
  'resource-groups':          'folder-open',
  'cost-management':          'currency-dollar',
  'automation':               'cog-6-tooth',
  // Data & Analytics
  'data-factory':             'arrows-right-left',
  'databricks':               'bolt',
  'stream-analytics':         'signal',
  'analysis-services':        'presentation-chart-bar',
};

// ─── Main ────────────────────────────────────────────────────────────────────

function syncNamespace(label, mapping, srcDir, destDir) {
  console.log(`\n📁 ${label} → ${destDir.replace(OUTPUT_DIR + '/', '')}/`);
  ensureDir(destDir);
  const isHeroicons = srcDir === HEROICONS_DIR;
  const isSimpleIcons = srcDir === SIMPLE_ICONS_DIR;
  for (const [ourName, srcName] of Object.entries(mapping)) {
    const src = resolve(srcDir, `${srcName}.svg`);
    if (!existsSync(src)) {
      console.warn(`  MISSING: ${src}`);
      continue;
    }
    let content;
    if (isHeroicons) content = processHeroiconSvg(src);
    else if (isSimpleIcons) content = processSimpleIconSvg(src);
    else content = readFileSync(src, 'utf8');
    writeSvg(content, destDir, ourName);
  }
}

function syncUi() {
  const destDir = resolve(OUTPUT_DIR, 'ui');
  console.log(`\n📁 ui: (Heroicons) → ui/`);
  ensureDir(destDir);
  // Deduplicate in case the same heroicon appears twice in UI_ICONS
  const seen = new Set();
  for (const name of UI_ICONS) {
    if (seen.has(name)) continue;
    seen.add(name);
    heroicon(name, destDir, name);
  }
}

function syncTech() {
  const destDir = resolve(OUTPUT_DIR, 'tech');
  console.log(`\n📁 tech: (Simple Icons) → tech/`);
  ensureDir(destDir);
  for (const [ourName, slug] of Object.entries(TECH_ICONS)) {
    simpleIcon(slug, destDir, ourName);
  }
}

function syncAwsNew() {
  const destDir = resolve(OUTPUT_DIR, 'aws');
  console.log(`\n📁 aws: new services (Heroicons) → aws/ (skipping existing official icons)`);
  ensureDir(destDir);
  for (const [ourName, heroName] of Object.entries(AWS_NEW_ICONS)) {
    const dest = resolve(destDir, `${ourName}.svg`);
    // Never overwrite existing official AWS icons with placeholders
    if (!FORCE && existsSync(dest)) {
      skipped++;
      continue;
    }
    heroicon(heroName, destDir, ourName);
  }
}

function syncGcpNew() {
  const destDir = resolve(OUTPUT_DIR, 'gcp');
  console.log(`\n📁 gcp: new services (Heroicons) → gcp/ (skipping existing official icons)`);
  ensureDir(destDir);
  for (const [ourName, heroName] of Object.entries(GCP_NEW_ICONS)) {
    const dest = resolve(destDir, `${ourName}.svg`);
    if (!FORCE && existsSync(dest)) {
      skipped++;
      continue;
    }
    heroicon(heroName, destDir, ourName);
  }
}

// Run all namespaces
syncUi();
syncTech();

syncNamespace(
  'security: (Heroicons)',
  SECURITY_ICONS,
  HEROICONS_DIR,
  resolve(OUTPUT_DIR, 'security'),
);
syncNamespace(
  'data: (Heroicons)',
  DATA_ICONS,
  HEROICONS_DIR,
  resolve(OUTPUT_DIR, 'data'),
);
syncNamespace(
  'net: (Heroicons)',
  NET_ICONS,
  HEROICONS_DIR,
  resolve(OUTPUT_DIR, 'net'),
);
syncNamespace(
  'azure: (Heroicons)',
  AZURE_ICONS,
  HEROICONS_DIR,
  resolve(OUTPUT_DIR, 'azure'),
);

syncAwsNew();
syncGcpNew();

console.log(`\n✅ Done.  Copied: ${copied}  Skipped (already exist): ${skipped}`);
console.log(`   Re-run with --force to overwrite all existing files.`);
console.log(`\n💡 To use official AWS/GCP/Azure icons, see scripts/download-cloud-icons.mjs`);
