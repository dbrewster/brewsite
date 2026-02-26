#!/usr/bin/env node
// Lucidchart .lucid (ZIP) → BrewSite Diagram DSL converter.

import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import AdmZip from 'adm-zip';
import Hjson from 'hjson';

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: node scripts/import-lucid.mjs <file.lucid> --page <n> --out <out.tsx>');
  process.exit(1);
}

const inputPath = argv[0];
let pageIndex = 0;
let outPath = null;

for (let i = 1; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--page') {
    const value = argv[i + 1];
    if (!value) throw new Error('Missing value for --page');
    pageIndex = Number.parseInt(value, 10);
    i++;
  } else if (arg === '--out') {
    const value = argv[i + 1];
    if (!value) throw new Error('Missing value for --out');
    outPath = value;
    i++;
  }
}

if (!outPath) {
  console.error('Missing --out <out.tsx>');
  process.exit(1);
}

const zip = new AdmZip(inputPath);
const entry = zip.getEntries().find((e) => e.entryName.endsWith('document.json'));
if (!entry) throw new Error('document.json not found in .lucid file');

const raw = entry.getData().toString('utf8');
const doc = Hjson.parse(raw);

const pickPages = (root) => root?.pages ?? root?.document?.pages ?? [];
const pages = pickPages(doc);
if (!Array.isArray(pages) || pages.length === 0) {
  throw new Error('No pages found in document.json');
}
if (pageIndex < 0 || pageIndex >= pages.length) {
  throw new Error(`Page index ${pageIndex} out of range (0..${pages.length - 1})`);
}

const page = pages[pageIndex];

const LUCID_SHAPE_MAP = {
  rectangleShape: 'flow:rect',
  roundedRectangleShape: 'flow:rounded',
  processShape: 'flow:rounded',
  decisionShape: 'flow:diamond',
  databaseShape: 'flow:cylinder',
  ovalShape: 'flow:oval',
  cloudShape: 'flow:cloud',
  actorShape: 'flow:actor',
  documentShape: 'flow:document',
  parallelogramShape: 'flow:parallelogram',
  'aws3.EC2': 'aws:ec2',
  'aws3.S3': 'aws:s3',
  'aws3.RDSInstance': 'aws:rds',
  'aws3.Lambda': 'aws:lambda',
  'aws3.ApplicationLoadBalancing': 'aws:alb',
  'aws3.CloudFront': 'aws:cloudfront',
  'aws3.VPC': 'aws:vpc',
  'aws3.ECSContainer': 'aws:ecs',
  'aws3.SQSQueue': 'aws:sqs',
  'aws3.SNSTopic': 'aws:sns',
};

const PIXEL_TO_UNIT = 100;

const isObject = (value) => value && typeof value === 'object';

const collectItems = (node, out = []) => {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((item) => collectItems(item, out));
    return out;
  }
  if (isObject(node)) {
    out.push(node);
    for (const value of Object.values(node)) {
      if (isObject(value)) collectItems(value, out);
    }
  }
  return out;
};

const allItems = collectItems(page, []);

const extractText = (obj) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return extractText(obj[0]);
  if (typeof obj.text === 'string') return obj.text;
  if (Array.isArray(obj.text)) return extractText(obj.text[0]);
  if (typeof obj.value === 'string') return obj.value;
  if (typeof obj.label === 'string') return obj.label;
  if (Array.isArray(obj.labels) && obj.labels[0]) return extractText(obj.labels[0]);
  return '';
};

const getBoundingBox = (obj) =>
  obj?.boundingBox ?? obj?.bounds ?? obj?.bbox ?? (obj?.geometry?.boundingBox ?? null);

const isLine = (obj) =>
  typeof obj?.type === 'string' && obj.type.toLowerCase().includes('line');

const isGroup = (obj) =>
  typeof obj?.type === 'string' && obj.type.toLowerCase().includes('group');

const isShape = (obj) =>
  getBoundingBox(obj) && typeof obj?.id === 'string' && !isLine(obj) && !isGroup(obj);

const shapes = allItems.filter(isShape);
const lines = allItems.filter(isLine);
const groups = allItems.filter(isGroup);

const nodes = shapes.map((shape) => {
  const box = getBoundingBox(shape);
  const x = (box?.x ?? 0) + (box?.w ?? box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.h ?? box?.height ?? 0) / 2;
  const w = box?.w ?? box?.width ?? 0;
  const h = box?.h ?? box?.height ?? 0;
  const id = String(shape.id ?? `node-${Math.random().toString(36).slice(2, 8)}`);
  const rawType = shape.type ?? shape.shapeType ?? shape.name ?? 'rectangleShape';
  const mapped = LUCID_SHAPE_MAP[rawType] ?? 'flow:rect';
  if (!LUCID_SHAPE_MAP[rawType]) {
    console.warn(`[import-lucid] Unknown shape type "${rawType}", falling back to flow:rect`);
  }
  const label = extractText(shape.text ?? shape.label ?? shape) || id;
  const color = shape?.style?.fill ?? shape?.style?.fillColor ?? undefined;

  return {
    id,
    label,
    shape: mapped,
    position: [x / PIXEL_TO_UNIT, -y / PIXEL_TO_UNIT, 0],
    size: [w / PIXEL_TO_UNIT, h / PIXEL_TO_UNIT],
    color,
    parentId: shape?.parentId ?? shape?.groupId ?? undefined,
  };
});

const edges = lines
  .map((line) => {
    const from = line?.endpoint1?.shapeId ?? line?.start?.shapeId ?? line?.start?.shape ?? null;
    const to = line?.endpoint2?.shapeId ?? line?.end?.shapeId ?? line?.end?.shape ?? null;
    if (!from || !to) return null;
    return { from: String(from), to: String(to) };
  })
  .filter(Boolean);

const groupNodes = new Map();
for (const node of nodes) {
  if (!node.parentId) continue;
  const list = groupNodes.get(node.parentId) ?? [];
  list.push(node.id);
  groupNodes.set(node.parentId, list);
}

const groupDsl = groups.map((group) => {
  const id = String(group.id ?? `group-${Math.random().toString(36).slice(2, 8)}`);
  const label = extractText(group.text ?? group.label ?? group) || id;
  const nodeIds = groupNodes.get(id) ?? [];
  return { id, label, nodeIds };
});

const escape = (value) => String(value).replace(/"/g, '\\"');

const nodeLines = nodes.map((node) => {
  const props = [
    `id=\"${escape(node.id)}\"`,
    `label=\"${escape(node.label)}\"`,
    `shape=\"${node.shape}\"`,
    `position={[${node.position.join(', ')}]}`,
    `size={[${node.size.join(', ')}]}`,
  ];
  if (node.color) props.push(`color=\"${escape(node.color)}\"`);
  return `    <DiagramNode ${props.join(' ')} />`;
});

const edgeLines = edges.map((edge) =>
  `    <DiagramEdge from=\"${escape(edge.from)}\" to=\"${escape(edge.to)}\" />`,
);

const groupLines = groupDsl
  .filter((group) => group.nodeIds.length > 0)
  .map((group) => {
    const children = group.nodeIds
      .map((id) => nodeLines.find((line) => line.includes(`id=\"${id}\"`)))
      .filter(Boolean)
      .map((line) => line.replace('    ', '      '))
      .join('\n');
    return `    <DiagramGroup id=\"${escape(group.id)}\" label=\"${escape(group.label)}\">\n${children}\n    </DiagramGroup>`;
  });

const nodeIdsInGroups = new Set(groupDsl.flatMap((g) => g.nodeIds));
const topLevelNodes = nodeLines.filter((line) => {
  const match = line.match(/id=\"([^\"]+)\"/);
  if (!match) return true;
  return !nodeIdsInGroups.has(match[1]);
});

const linesOut = [
  `// Auto-generated by import-lucid.mjs from: ${basename(inputPath)}`,
  `// Page: ${pageIndex}`,
  `// Imported: ${new Date().toISOString().slice(0, 10)}`,
  '',
  `import { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from '@brewsite/diagram';`,
  '',
  `export const importedDiagram = (`,
  `  <Diagram id="${escape(page?.id ?? 'diagram-imported')}" layout="manual">`,
  groupLines.length ? groupLines.join('\n') : '',
  topLevelNodes.join('\n'),
  edgeLines.length ? '' : '',
  edgeLines.join('\n'),
  `  </Diagram>`,
  `);`,
  '',
].filter(Boolean);

const output = linesOut.join('\n');
writeFileSync(resolve(outPath), output, 'utf8');
console.log(`Wrote ${outPath}`);
