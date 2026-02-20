/**
 * gen-scene-dsl.mjs
 *
 * CLI:
 *   node scripts/gen-scene-dsl.mjs --input <sceneResources.ts> --out-dir <dir> [--manifest-out <path>] [--page-ids a,b]
 *
 * Reads a sceneResources object export and generates typed DSL wrappers and (optionally)
 * a version-2 AssetManifest JSON.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const inputPath = getArg('--input');
const outDir = getArg('--out-dir');
const manifestOut = getArg('--manifest-out');
const pageIdsArg = getArg('--page-ids');

if (!inputPath || !outDir) {
  console.error('[gen-scene-dsl] Missing required args: --input and --out-dir');
  process.exit(1);
}

const absInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
const absOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(process.cwd(), outDir);
const absManifestOut = manifestOut
  ? (path.isAbsolute(manifestOut) ? manifestOut : path.resolve(process.cwd(), manifestOut))
  : null;

const source = await readFile(absInput, 'utf8');

const ast = parse(source, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
});

const isExportedConst = (node, name) => {
  if (node.type !== 'ExportNamedDeclaration') return false;
  const decl = node.declaration;
  if (!decl || decl.type !== 'VariableDeclaration') return false;
  return decl.declarations.some(
    (d) => d.id && d.id.type === 'Identifier' && d.id.name === name,
  );
};

const getExportedConstInit = (node, name) => {
  const decl = node.declaration;
  if (!decl || decl.type !== 'VariableDeclaration') return null;
  const match = decl.declarations.find(
    (d) => d.id && d.id.type === 'Identifier' && d.id.name === name,
  );
  return match?.init ?? null;
};

const unwrapExpression = (node) => {
  if (!node) return null;
  if (node.type === 'ParenthesizedExpression') return unwrapExpression(node.expression);
  if (node.type === 'TSAsExpression') return unwrapExpression(node.expression);
  if (node.type === 'TSNonNullExpression') return unwrapExpression(node.expression);
  return node;
};

const getObjectLiteral = (node) => (node && node.type === 'ObjectExpression' ? node : null);

const getObjectProp = (obj, name) => {
  return obj.properties.find(
    (p) =>
      p.type === 'ObjectProperty' &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name)),
  );
};

const readStringLiteral = (node, name) => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return null;
  if (unwrapped.type === 'StringLiteral') return unwrapped.value;
  throw new Error(`Attribute ${name} must be a string literal.`);
};

const readStringProp = (obj, name, { required = false } = {}) => {
  const prop = getObjectProp(obj, name);
  if (!prop) {
    if (required) throw new Error(`Missing required attribute: ${name}`);
    return null;
  }
  if (prop.type !== 'ObjectProperty') {
    if (required) throw new Error(`Invalid attribute: ${name}`);
    return null;
  }
  return readStringLiteral(prop.value, name);
};

const readStringArrayProp = (obj, name, { required = false } = {}) => {
  const prop = getObjectProp(obj, name);
  if (!prop) {
    if (required) throw new Error(`Missing required attribute: ${name}`);
    return null;
  }
  if (prop.type !== 'ObjectProperty') {
    if (required) throw new Error(`Invalid attribute: ${name}`);
    return null;
  }
  const value = unwrapExpression(prop.value);
  if (!value || value.type !== 'ArrayExpression') {
    throw new Error(`Attribute ${name} must be an array of string literals.`);
  }
  return value.elements.map((el, idx) => {
    if (!el) throw new Error(`Attribute ${name}[${idx}] is missing`);
    return readStringLiteral(el, `${name}[${idx}]`);
  });
};

let resourcesNode = null;
for (const node of ast.program.body) {
  if (isExportedConst(node, 'sceneResources')) {
    const init = getExportedConstInit(node, 'sceneResources');
    resourcesNode = unwrapExpression(init);
    break;
  }
}

if (!resourcesNode) {
  console.error('[gen-scene-dsl] Missing required export: sceneResources');
  process.exit(1);
}

const resourcesObj = getObjectLiteral(resourcesNode);
if (!resourcesObj) {
  console.error('[gen-scene-dsl] sceneResources must be an object literal.');
  process.exit(1);
}

const getArrayProp = (obj, name) => {
  const prop = getObjectProp(obj, name);
  if (!prop || prop.type !== 'ObjectProperty') return [];
  const value = unwrapExpression(prop.value);
  if (!value || value.type !== 'ArrayExpression') return [];
  return value.elements.filter(Boolean);
};

const modelDefs = [];
const containedDefs = [];
const animDefs = [];
const allowedRoles = new Set(['primary', 'brain', 'attachment', 'unknown']);

try {
  const modelNodes = getArrayProp(resourcesObj, 'models');
  for (const entry of modelNodes) {
    const obj = getObjectLiteral(unwrapExpression(entry));
    if (!obj) continue;
    const id = readStringProp(obj, 'id', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    const role = readStringProp(obj, 'role', { required: true });
    const anchorKeys = readStringArrayProp(obj, 'anchorKeys', { required: false }) ?? [];
    if (!id || !pathValue || !role) throw new Error('Missing required attributes on model definition.');
    if (!allowedRoles.has(role)) {
      throw new Error(`Invalid role "${role}". Expected one of: ${Array.from(allowedRoles).join(', ')}`);
    }
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    modelDefs.push({ id, path: pathValue, role, anchorKeys });
  }

  const containedNodes = getArrayProp(resourcesObj, 'containedModels');
  for (const entry of containedNodes) {
    const obj = getObjectLiteral(unwrapExpression(entry));
    if (!obj) continue;
    const id = readStringProp(obj, 'id', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    if (!id || !pathValue) throw new Error('Missing required attributes on containedModel definition.');
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    containedDefs.push({ id, path: pathValue });
  }

  const animNodes = getArrayProp(resourcesObj, 'animations');
  for (const entry of animNodes) {
    const obj = getObjectLiteral(unwrapExpression(entry));
    if (!obj) continue;
    const id = readStringProp(obj, 'id', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    const clipName = readStringProp(obj, 'clipName', { required: false });
    if (!id || !pathValue) throw new Error('Missing required attributes on animation definition.');
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    animDefs.push({ id, path: pathValue, clipName: clipName ?? null });
  }
} catch (err) {
  console.error('[gen-scene-dsl] Invalid sceneResources:', err?.message ?? err);
  process.exit(1);
}

const idSet = new Set();
for (const entry of modelDefs) {
  if (idSet.has(entry.id)) {
    console.error(`[gen-scene-dsl] Duplicate model id: ${entry.id}`);
    process.exit(1);
  }
  idSet.add(entry.id);
}
const containedIdSet = new Set();
for (const entry of containedDefs) {
  if (containedIdSet.has(entry.id)) {
    console.error(`[gen-scene-dsl] Duplicate contained model id: ${entry.id}`);
    process.exit(1);
  }
  containedIdSet.add(entry.id);
}
const animIdSet = new Set();
for (const entry of animDefs) {
  if (animIdSet.has(entry.id)) {
    console.error(`[gen-scene-dsl] Duplicate animation id: ${entry.id}`);
    process.exit(1);
  }
  animIdSet.add(entry.id);
}

const canonicalizeName = (raw) => {
  const cleaned = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  if (!cleaned) return 'Part';
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
  const safe = name.match(/^[A-Za-z_]/) ? name : `Part${name}`;
  return safe || 'Part';
};
const makeUnion = (values) => {
  if (!values.length) return 'string';
  return values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(' | ');
};

const modelIdUnion = makeUnion(modelDefs.map((m) => m.id));
const animationIdUnion = makeUnion(animDefs.map((a) => a.id));
const containedIdUnion = makeUnion(containedDefs.map((c) => c.id));
const pageIds = pageIdsArg ? pageIdsArg.split(',').map((v) => v.trim()).filter(Boolean) : [];
const scenePageIdUnion = makeUnion(pageIds);

const assetRoot = path.resolve(ROOT, 'public');

const toAssetPath = (urlPath) => {
  if (!urlPath.startsWith('/assets/')) {
    throw new Error(`Invalid asset path "${urlPath}". Expected to start with /assets/.`);
  }
  return path.resolve(assetRoot, urlPath.replace('/assets/', 'assets/'));
};

const io = new (await import('@gltf-transform/core')).NodeIO();
const ext = await import('@gltf-transform/extensions');
io.registerExtensions([
  ext.KHRMeshQuantization,
  ext.KHRTextureBasisu,
  ext.KHRTextureTransform,
]);

const readGlb = async (urlPath) => {
  const abs = toAssetPath(urlPath);
  try {
    const doc = await io.read(abs);
    return doc.getRoot();
  } catch (err) {
    throw new Error(`Could not read ${urlPath}: ${err?.message ?? err}`);
  }
};

const animationDuration = (anim) => {
  let max = 0;
  for (const sampler of anim.listSamplers()) {
    const input = sampler.getInput();
    if (!input) continue;
    const m = input.getMax([])[0];
    if (typeof m === 'number' && m > max) max = m;
  }
  return Math.round(max * 1000) / 1000;
};

const resolveAnchorTarget = (key, nodeNames) => {
  const lowerKey = key.toLowerCase();
  const exact = nodeNames.find((n) => n.toLowerCase() === lowerKey);
  if (exact) return exact;
  const suffix = nodeNames.find((n) => n.toLowerCase().endsWith(`:${lowerKey}`));
  if (suffix) return suffix;
  const contains = nodeNames.find((n) => {
    const lower = n.toLowerCase();
    return lower.includes(lowerKey) && !lower.includes('end');
  });
  if (contains) return contains;
  console.warn(`[gen-scene-dsl] Anchor key "${key}" not found. Using key as value.`);
  return key;
};

const modelRegistry = {};
const modelBodyParts = {};
for (const entry of modelDefs) {
  const root = await readGlb(entry.path);
  const nodes = root.listNodes();
  const bones = nodes.map((n) => n.getName()).filter(Boolean).sort();
  const meshes = root.listMeshes().map((m) => m.getName()).filter(Boolean).sort();
  const anchorTargets = {};
  for (const anchorKey of entry.anchorKeys ?? []) {
    anchorTargets[anchorKey] = resolveAnchorTarget(anchorKey, bones);
  }
  modelRegistry[entry.id] = {
    id: entry.id,
    glb: entry.path,
    bones,
    meshes,
    anchorTargets,
  };
  modelBodyParts[entry.id] = meshes;
}

const containedRegistry = {};
const containedSubparts = {};
for (const entry of containedDefs) {
  const root = await readGlb(entry.path);
  const subparts = root
    .listNodes()
    .filter((n) => n.getMesh && n.getMesh())
    .map((n) => n.getName())
    .filter(Boolean)
    .sort();
  containedRegistry[entry.id] = {
    id: entry.id,
    glb: entry.path,
    subparts,
  };
  containedSubparts[entry.id] = subparts;
}

const animationRegistry = {};
for (const entry of animDefs) {
  const root = await readGlb(entry.path);
  const anims = root.listAnimations();
  if (!anims.length) {
    throw new Error(`No animations found in ${entry.path}`);
  }
  let chosen = anims[0];
  if (entry.clipName) {
    const found = anims.find((a) => a.getName() === entry.clipName);
    if (found) chosen = found;
  }
  const clipName = entry.clipName ?? chosen.getName();
  if (!clipName) {
    throw new Error(`Animation in ${entry.path} has no name`);
  }
  animationRegistry[entry.id] = {
    id: entry.id,
    glb: entry.path,
    clipName,
    duration: animationDuration(chosen),
  };
}

const resourceOutput = `/* eslint-disable */\n// Auto-generated by scripts/gen-scene-dsl.mjs.\n\nexport type ModelId = ${modelIdUnion};\nexport type AnimationId = ${animationIdUnion};\nexport type ContainedModelId = ${containedIdUnion};\n${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};\n` : ''}\n`;

const modelBodyPartTypes = modelDefs.map((entry) => {
  const name = canonicalizeName(entry.id);
  const typeName = `${name}BodyPartId`;
  const union = makeUnion(modelBodyParts[entry.id] ?? []);
  return `export type ${typeName} = ${union};`;
}).join('\n');

const containedSubpartTypes = containedDefs.map((entry) => {
  const name = canonicalizeName(entry.id);
  const typeName = `${name}SubpartId`;
  const union = makeUnion(containedSubparts[entry.id] ?? []);
  return `export type ${typeName} = ${union};`;
}).join('\n');

const toRelative = (abs) => {
  const rel = path.relative(absOutDir, abs).replaceAll(path.sep, '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
};

const modelDslImportPath = '@brewsite/core';

const dslOutput = `/* eslint-disable */\n// Auto-generated by scripts/gen-scene-dsl.mjs.\n\nimport type { ReactNode } from 'react';\nimport { Model as BaseModel, BodyParts as BaseBodyParts, BodyPart as BaseBodyPart, Pose as BasePose, ModelPart as BaseModelPart, ContainedModel as BaseContainedModel, Subpart as BaseSubpart, Playback as BasePlayback, Motion as BaseMotion, Animation as BaseAnimation } from '${modelDslImportPath}';\n\nexport type ModelId = ${modelIdUnion};\nexport type AnimationId = ${animationIdUnion};\nexport type ContainedModelId = ${containedIdUnion};\n${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};\n` : ''}\n\n${modelBodyPartTypes}\n\n${containedSubpartTypes}\n\nexport type ModelDslProps<TBodyPartId extends string = string> = Omit<Parameters<typeof BaseModel>[0], 'id'> & { id?: ModelId; children?: ReactNode };\nexport type AnimationProps = Parameters<typeof BaseAnimation>[0] & { clipName?: AnimationId };\nexport type BodyPartProps<TBodyPartId extends string = string> = Omit<Parameters<typeof BaseBodyPart>[0], 'id'> & { id: TBodyPartId };\nexport type ModelPartProps = Parameters<typeof BaseModelPart>[0];\nexport type ContainedModelProps = Parameters<typeof BaseContainedModel>[0] & { modelId: ContainedModelId };\nexport type SubpartProps<TSubpartId extends string = string> = Omit<Parameters<typeof BaseSubpart>[0], 'id'> & { id: TSubpartId };\n\nexport const Model = (props: ModelDslProps) => BaseModel(props as Parameters<typeof BaseModel>[0]);\nexport const BodyParts = BaseBodyParts;\nexport const BodyPart = (props: BodyPartProps) => BaseBodyPart(props as Parameters<typeof BaseBodyPart>[0]);\nexport const Pose = BasePose;\nexport const ModelPart = (props: ModelPartProps) => BaseModelPart(props as Parameters<typeof BaseModelPart>[0]);\nexport const ContainedModel = (props: ContainedModelProps) => BaseContainedModel(props as Parameters<typeof BaseContainedModel>[0]);\nexport const Subpart = (props: SubpartProps) => BaseSubpart(props as Parameters<typeof BaseSubpart>[0]);\nexport const Playback = BasePlayback;\nexport const Motion = BaseMotion;\nexport const Animation = (props: AnimationProps) => BaseAnimation(props as Parameters<typeof BaseAnimation>[0]);\n\n${modelDefs.map((entry) => {
  const name = canonicalizeName(entry.id);
  const typeName = `${name}BodyPartId`;
  const propsName = `${name}ModelProps`;
  const componentName = `${name}Model`;
  return `export type ${propsName} = ModelDslProps<${typeName}>;\nexport const ${componentName} = (props: ${propsName}) => BaseModel({ ...props, id: '${entry.id}' });`;
}).join('\n\n')}\n`;

await mkdir(absOutDir, { recursive: true });
await writeFile(path.join(absOutDir, 'sceneResources.generated.ts'), `${resourceOutput}\n${modelBodyPartTypes}\n\n${containedSubpartTypes}\n`, 'utf8');
await writeFile(path.join(absOutDir, 'sceneDsl.generated.tsx'), dslOutput, 'utf8');
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneResources.generated.ts')}`);
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneDsl.generated.tsx')}`);

if (absManifestOut) {
  const manifest = {
    version: 2,
    models: Object.values(modelRegistry),
    containedModels: Object.values(containedRegistry),
    animations: Object.values(animationRegistry),
  };
  await mkdir(path.dirname(absManifestOut), { recursive: true });
  await writeFile(absManifestOut, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[gen-scene-dsl] Wrote ${absManifestOut}`);
}
