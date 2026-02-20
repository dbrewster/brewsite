/**
 * gen-scene-dsl.mjs
 *
 * CLI:
 *   node scripts/gen-scene-dsl.mjs --input <resources.tsx> --out-dir <dir> [--page-ids a,b]
 *
 * Reads a shared sceneResources JSX export and generates a typed DSL module.
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
const pageIdsArg = getArg('--page-ids');

if (!inputPath || !outDir) {
  console.error('[gen-scene-dsl] Missing required args: --input and --out-dir');
  process.exit(1);
}

const absInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
const absOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(process.cwd(), outDir);

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
  return node;
};

const getJsxName = (node) => {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  return null;
};

const getCallName = (node) => {
  if (!node || node.type !== 'CallExpression') return null;
  if (node.callee.type === 'Identifier') return node.callee.name;
  return null;
};

const getObjectLiteral = (node) => (node && node.type === 'ObjectExpression' ? node : null);

const getObjectStringProp = (obj, name, { required = false } = {}) => {
  if (!obj) {
    if (required) throw new Error(`Missing object for attribute: ${name}`);
    return null;
  }
  const prop = obj.properties.find(
    (p) =>
      p.type === 'ObjectProperty' &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name)),
  );
  if (!prop) {
    if (required) throw new Error(`Missing required attribute: ${name}`);
    return null;
  }
  if (prop.value.type === 'StringLiteral') return prop.value.value;
  throw new Error(`Attribute ${name} must be a string literal.`);
};

const getStringAttr = (attrs, name, { required = false } = {}) => {
  const attr = attrs.find(
    (a) => a.type === 'JSXAttribute' && a.name?.name === name,
  );
  if (!attr) {
    if (required) throw new Error(`Missing required attribute: ${name}`);
    return null;
  }
  if (!attr.value) {
    if (required) throw new Error(`Missing value for attribute: ${name}`);
    return null;
  }
  if (attr.value.type === 'StringLiteral') return attr.value.value;
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'StringLiteral') {
    return attr.value.expression.value;
  }
  throw new Error(`Attribute ${name} must be a string literal.`);
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

const modelDefs = [];
const animDefs = [];
const allowedRoles = new Set(['primary', 'brain', 'attachment', 'unknown']);

const registerModel = ({ id, pathValue, role, parts }) => {
  if (!id || !pathValue || !role) throw new Error('Missing required attributes on ModelDefinition.');
  if (!allowedRoles.has(role)) {
    throw new Error(`Invalid role \"${role}\". Expected one of: ${Array.from(allowedRoles).join(', ')}`);
  }
  if (!pathValue.startsWith('/assets/')) {
    throw new Error(`Invalid path \"${pathValue}\". Expected to start with /assets/.`);
  }
  modelDefs.push({ id, path: pathValue, role, parts });
};

const registerAnimation = ({ id, pathValue, clipName }) => {
  if (!id || !pathValue) throw new Error('Missing required attributes on AnimationDefinition.');
  if (!pathValue.startsWith('/assets/')) {
    throw new Error(`Invalid path \"${pathValue}\". Expected to start with /assets/.`);
  }
  animDefs.push({ id, path: pathValue, clipName: clipName ?? null });
};

const parseJsxResources = (node) => {
  if (node.type !== 'JSXElement') {
    throw new Error('sceneResources must be a JSX element (<Resources>...</Resources>) or Resources([...]) call.');
  }
  const rootName = getJsxName(node.openingElement.name);
  if (rootName !== 'Resources') {
    throw new Error(`sceneResources root must be <Resources>, got <${rootName ?? 'unknown'}>.`);
  }
  for (const child of node.children) {
    if (!child || child.type !== 'JSXElement') continue;
    const name = getJsxName(child.openingElement.name);
    if (name === 'ModelDefinition') {
      const attrs = child.openingElement.attributes;
      const id = getStringAttr(attrs, 'id', { required: true });
      const pathValue = getStringAttr(attrs, 'path', { required: true });
      const role = getStringAttr(attrs, 'role', { required: true });
      registerModel({ id, pathValue, role });
    } else if (name === 'AnimationDefinition') {
      const attrs = child.openingElement.attributes;
      const id = getStringAttr(attrs, 'id', { required: true });
      const pathValue = getStringAttr(attrs, 'path', { required: true });
      const clipName = getStringAttr(attrs, 'clipName', { required: false });
      registerAnimation({ id, pathValue, clipName });
    }
  }
};

const parseCallResources = (node) => {
  const callName = getCallName(node);
  if (callName !== 'Resources') {
    throw new Error('sceneResources must be a JSX <Resources> element or Resources(...) call.');
  }
  const arg = node.arguments[0];
  const entries = [];
  if (!arg) return;
  if (arg.type === 'ArrayExpression') {
    entries.push(...arg.elements.filter(Boolean));
  } else {
    entries.push(arg);
  }
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.type !== 'CallExpression') continue;
    const entryName = getCallName(entry);
    const propsArg = entry.arguments[0];
    const obj = getObjectLiteral(propsArg);
    if (!obj) continue;
    if (entryName === 'ModelDefinition') {
      const id = getObjectStringProp(obj, 'id', { required: true });
      const pathValue = getObjectStringProp(obj, 'path', { required: true });
      const role = getObjectStringProp(obj, 'role', { required: true });
      const partsProp = obj.properties.find(
        (p) =>
          p.type === 'ObjectProperty' &&
          ((p.key.type === 'Identifier' && p.key.name === 'parts') ||
            (p.key.type === 'StringLiteral' && p.key.value === 'parts')),
      );
      const partsValue = partsProp && partsProp.type === 'ObjectProperty' ? partsProp.value : null;
      let parts = undefined;
      if (partsValue && partsValue.type === 'ObjectExpression') {
        const entries = {};
        for (const prop of partsValue.properties) {
          if (prop.type !== 'ObjectProperty') continue;
          const key =
            prop.key.type === 'Identifier'
              ? prop.key.name
              : prop.key.type === 'StringLiteral'
                ? prop.key.value
                : null;
          if (!key) continue;
          if (prop.value.type !== 'ObjectExpression') continue;
          const partObj = prop.value;
          const idVal = getObjectStringProp(partObj, 'id', { required: true });
          const anchorVal = getObjectStringProp(partObj, 'anchor', { required: true });
          const modelIdVal = getObjectStringProp(partObj, 'modelId', { required: false });
          const readNumber = (node) => {
            if (!node) return null;
            if (node.type === 'NumericLiteral') return node.value;
            if (node.type === 'UnaryExpression' && node.argument.type === 'NumericLiteral') {
              return node.operator === '-' ? -node.argument.value : node.argument.value;
            }
            return null;
          };
          const readVec = (name) => {
            const p = partObj.properties.find(
              (p) =>
                p.type === 'ObjectProperty' &&
                ((p.key.type === 'Identifier' && p.key.name === name) ||
                  (p.key.type === 'StringLiteral' && p.key.value === name)),
            );
            if (!p || p.type !== 'ObjectProperty') return undefined;
            if (p.value.type !== 'ArrayExpression') return undefined;
            const nums = p.value.elements.map((el) => readNumber(el));
            if (nums.length !== 3 || nums.some((n) => n === null)) return undefined;
            return [nums[0], nums[1], nums[2]];
          };
          const position = readVec('position');
          const rotation = readVec('rotation');
          let scale = undefined;
          const scaleProp = partObj.properties.find(
            (p) =>
              p.type === 'ObjectProperty' &&
              ((p.key.type === 'Identifier' && p.key.name === 'scale') ||
                (p.key.type === 'StringLiteral' && p.key.value === 'scale')),
          );
          if (scaleProp && scaleProp.type === 'ObjectProperty') {
            const scaleValue = readNumber(scaleProp.value);
            if (typeof scaleValue === 'number') scale = scaleValue;
          }
          entries[key] = {
            id: idVal,
            anchor: anchorVal,
            modelId: modelIdVal ?? undefined,
            position,
            rotation,
            scale,
          };
        }
        parts = entries;
      }
      registerModel({ id, pathValue, role, parts });
    } else if (entryName === 'AnimationDefinition') {
      const id = getObjectStringProp(obj, 'id', { required: true });
      const pathValue = getObjectStringProp(obj, 'path', { required: true });
      const clipName = getObjectStringProp(obj, 'clipName', { required: false });
      registerAnimation({ id, pathValue, clipName });
    }
  }
};

try {
  if (resourcesNode.type === 'JSXElement') {
    parseJsxResources(resourcesNode);
  } else if (resourcesNode.type === 'CallExpression') {
    parseCallResources(resourcesNode);
  } else {
    throw new Error('sceneResources must be a JSX <Resources> element or Resources(...) call.');
  }
} catch (err) {
  console.error('[gen-scene-dsl] Invalid sceneResources:', err?.message ?? err);
  process.exit(1);
}

const idSet = new Set();
for (const entry of modelDefs) {
  if (idSet.has(entry.id)) {
    console.error(`[gen-scene-dsl] Duplicate ModelDefinition id: ${entry.id}`);
    process.exit(1);
  }
  idSet.add(entry.id);
}
const animIdSet = new Set();
for (const entry of animDefs) {
  if (animIdSet.has(entry.id)) {
    console.error(`[gen-scene-dsl] Duplicate AnimationDefinition id: ${entry.id}`);
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

const resolveBone = (boneNames, candidates, fallbackPattern) => {
  for (const candidate of candidates) {
    if (boneNames.includes(candidate)) return candidate;
  }
  return boneNames.find((n) => fallbackPattern.test(n)) ?? null;
};

const HEAD_BONE_CANDIDATES = ['mixamorig:Head', 'HEAD'];
const CHEST_BONE_CANDIDATES = ['mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Spine', 'CHEST'];

const modelRegistry = {};
for (const entry of modelDefs) {
  const root = await readGlb(entry.path);
  const bones = root.listNodes().map((n) => n.getName()).filter(Boolean).sort();
  const meshes = root.listMeshes().map((m) => m.getName()).filter(Boolean).sort();
  const anchorTargets = {
    head: resolveBone(bones, HEAD_BONE_CANDIDATES, /head/i),
    chest: resolveBone(bones, CHEST_BONE_CANDIDATES, /spine|chest|torso/i),
  };
  const subparts = entry.role === 'brain'
    ? bones.filter((n) => !n.startsWith('marker_'))
    : undefined;
  modelRegistry[entry.id] = {
    id: entry.id,
    role: entry.role,
    path: entry.path,
    bones,
    meshes,
    bodyParts: meshes,
    anchors: anchorTargets,
    subparts,
    parts: entry.parts,
  };
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
    path: entry.path,
    clipName,
    duration: animationDuration(chosen),
  };
}


const primaryModelEntry = modelDefs.find((m) => m.role === 'primary') ?? modelDefs[0];
const primaryModel = primaryModelEntry ? modelRegistry[primaryModelEntry.id] : null;
const meshNames = primaryModel?.meshes ?? [];
const bodyPartComponents = [];
const usedBodyPartNames = new Map();
for (const meshName of meshNames) {
  const base = canonicalizeName(meshName);
  let name = base;
  let counter = 1;
  while (usedBodyPartNames.has(name)) {
    counter += 1;
    name = `${base}${counter}`;
  }
  usedBodyPartNames.set(name, meshName);
  bodyPartComponents.push({ name, id: meshName });
}

const subpartModelEntry = modelDefs.find((m) => m.role === 'brain');
const subpartModel = subpartModelEntry ? modelRegistry[subpartModelEntry.id] : null;
const subpartIds = subpartModel?.subparts ?? [];
const subpartComponents = [];
const usedSubpartNames = new Map();
for (const subpart of subpartIds) {
  const base = canonicalizeName(subpart);
  let name = base;
  let counter = 1;
  while (usedSubpartNames.has(name)) {
    counter += 1;
    name = `${base}${counter}`;
  }
  usedSubpartNames.set(name, subpart);
  subpartComponents.push({ name, id: subpart });
}
const registryJson = JSON.stringify({ models: modelRegistry, animations: animationRegistry }, null, 2);

const output = `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

export type ModelId = ${modelIdUnion};
export type AnimationId = ${animationIdUnion};
${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};` : ''}

export type ModelRole = 'primary' | 'brain' | 'attachment' | 'unknown';

export type ModelPartId = string;
export type ModelPartAnchor = string;

export type ModelPartDefinition = {
  id: ModelPartId;
  anchor: ModelPartAnchor;
  modelId?: ModelId;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
};

export type ModelRegistryEntry = {
  id: ModelId;
  role: ModelRole;
  path: string;
  bones: string[];
  meshes: string[];
  anchors: { [key: string]: string | null | undefined };
  subparts?: string[];
  bodyParts?: string[];
  parts?: Record<ModelPartId, ModelPartDefinition>;
};

export type AnimationRegistryEntry = {
  id: AnimationId;
  path: string;
  clipName: string;
  duration: number;
};

export type ResourceRegistry = {
  models: Record<ModelId, ModelRegistryEntry>;
  animations: Record<AnimationId, AnimationRegistryEntry>;
};

export const resourceRegistry: ResourceRegistry = ${registryJson};
`;

const bodyPartExports = bodyPartComponents
  .map(({ name, id }) => `export const ${name} = (props: Omit<BodyPartProps, 'id'>) => <BodyPart id="${id}" {...props} />;`)
  .join('\n');
const modelPartIds = Array.from(new Set(Object.values(modelRegistry).flatMap((entry) => Object.keys(entry.parts ?? {}))));
const modelPartUnion = makeUnion(modelPartIds);
const subpartExports = subpartComponents
  .map(({ name, id }) => `export const ${name} = (props: Omit<SubpartProps, 'id'>) => <Subpart id="${id}" {...props} />;`)
  .join('\n');

const dslOutput = `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

import type { ReactNode } from 'react';
import { Model as BaseModel, BodyParts as BaseBodyParts, BodyPart as BaseBodyPart, Pose as BasePose, ModelPart as BaseModelPart, ContainedModel as BaseContainedModel, Subpart as BaseSubpart, Playback as BasePlayback, Motion as BaseMotion, Animation as BaseAnimation } from '../robot/elements/model/dsl';

export type ModelId = ${modelIdUnion};
export type AnimationId = ${animationIdUnion};
export type BodyMeshId = ${meshNames.length ? meshNames.map((m) => `'${m.replace("'", "\'")}'`).join(' | ') : 'string'};
export type BodyPartId = BodyMeshId | string;
export type ModelPartId = ${modelPartIds.length ? modelPartUnion : 'string'};
export type SubpartId = ${subpartIds.length ? subpartIds.map((m) => `'${m.replace("'", "\'")}'`).join(' | ') : 'string'};

export type ModelProps = Parameters<typeof BaseModel>[0] & { id: ModelId };
export type AnimationProps = Parameters<typeof BaseAnimation>[0] & { clipName?: AnimationId };
export type BodyPartProps = Parameters<typeof BaseBodyPart>[0] & { id: BodyPartId };
export type ModelPartProps = Parameters<typeof BaseModelPart>[0] & { id: ModelPartId };
export type ContainedModelProps = Parameters<typeof BaseContainedModel>[0] & { modelId: ModelId };
export type SubpartProps = Parameters<typeof BaseSubpart>[0] & { id: SubpartId };

export const Model = (props: ModelProps) => BaseModel(props);
export const BodyParts = BaseBodyParts;
export const BodyPart = (props: BodyPartProps) => BaseBodyPart(props);
export const Pose = BasePose;
export const ModelPart = (props: ModelPartProps) => BaseModelPart(props);
export const ContainedModel = (props: ContainedModelProps) => BaseContainedModel(props);
export const Subpart = (props: SubpartProps) => BaseSubpart(props);
export const Playback = BasePlayback;
export const Motion = BaseMotion;
export const Animation = (props: AnimationProps) => BaseAnimation(props);

${bodyPartExports}

${subpartExports}
`;
await mkdir(absOutDir, { recursive: true });
await writeFile(path.join(absOutDir, 'sceneResources.generated.ts'), output);
await writeFile(path.join(absOutDir, 'sceneDsl.generated.tsx'), dslOutput);
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneResources.generated.ts')}`);
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneDsl.generated.tsx')}`);
