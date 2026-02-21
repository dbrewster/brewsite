/**
 * gen-scene-dsl.mjs
 *
 * CLI:
 *   node scripts/gen-scene-dsl.mjs --input <siteResources.ts> --out-dir <dir> [--manifest-out <path>] [--page-ids a,b]
 *
 * Reads a siteResources object export and generates typed DSL wrappers and a
 * version-2 AssetManifest JSON (defaults to public/assets/scene-manifest.json).
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
const defaultManifestOut = path.resolve(ROOT, 'public', 'assets', 'scene-manifest.json');
const absManifestOut = manifestOut
  ? (path.isAbsolute(manifestOut) ? manifestOut : path.resolve(process.cwd(), manifestOut))
  : defaultManifestOut;

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

const RESERVED_TYPE_NAMES = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield', 'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'await',
]);

const isValidTypeName = (value) => (
  typeof value === 'string' &&
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) &&
  !RESERVED_TYPE_NAMES.has(value)
);

const assertValidTypeName = (value, label) => {
  if (!isValidTypeName(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Expected a legal TypeScript type name (identifier).`,
    );
  }
};

let resourcesNode = null;
for (const node of ast.program.body) {
  if (isExportedConst(node, 'siteResources')) {
    const init = getExportedConstInit(node, 'siteResources');
    resourcesNode = unwrapExpression(init);
    break;
  }
}

if (!resourcesNode) {
  console.error('[gen-scene-dsl] Missing required export: siteResources');
  process.exit(1);
}

const resourcesObj = getObjectLiteral(resourcesNode);
if (!resourcesObj) {
  console.error('[gen-scene-dsl] siteResources must be an object literal.');
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
    const type = readStringProp(obj, 'type', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    const role = readStringProp(obj, 'role', { required: true });
    const anchorKeys = readStringArrayProp(obj, 'anchorKeys', { required: false }) ?? [];
    if (!type || !pathValue || !role) throw new Error('Missing required attributes on model definition.');
    assertValidTypeName(type, 'model.type');
    if (!allowedRoles.has(role)) {
      throw new Error(`Invalid role "${role}". Expected one of: ${Array.from(allowedRoles).join(', ')}`);
    }
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    modelDefs.push({ type, path: pathValue, role, anchorKeys });
  }

  const containedNodes = getArrayProp(resourcesObj, 'containedModels');
  for (const entry of containedNodes) {
    const obj = getObjectLiteral(unwrapExpression(entry));
    if (!obj) continue;
    const type = readStringProp(obj, 'type', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    if (!type || !pathValue) throw new Error('Missing required attributes on containedModel definition.');
    assertValidTypeName(type, 'containedModel.type');
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    containedDefs.push({ type, path: pathValue });
  }

  const animNodes = getArrayProp(resourcesObj, 'animations');
  for (const entry of animNodes) {
    const obj = getObjectLiteral(unwrapExpression(entry));
    if (!obj) continue;
    const type = readStringProp(obj, 'type', { required: true });
    const pathValue = readStringProp(obj, 'path', { required: true });
    const clipName = readStringProp(obj, 'clipName', { required: false });
    if (!type || !pathValue) throw new Error('Missing required attributes on animation definition.');
    assertValidTypeName(type, 'animation.type');
    if (!pathValue.startsWith('/assets/')) {
      throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
    }
    animDefs.push({ type, path: pathValue, clipName: clipName ?? null });
  }
} catch (err) {
  console.error('[gen-scene-dsl] Invalid siteResources:', err?.message ?? err);
  process.exit(1);
}

const idSet = new Set();
for (const entry of modelDefs) {
  if (idSet.has(entry.type)) {
    console.error(`[gen-scene-dsl] Duplicate model type: ${entry.type}`);
    process.exit(1);
  }
  idSet.add(entry.type);
}
const containedIdSet = new Set();
for (const entry of containedDefs) {
  if (containedIdSet.has(entry.type)) {
    console.error(`[gen-scene-dsl] Duplicate contained model type: ${entry.type}`);
    process.exit(1);
  }
  containedIdSet.add(entry.type);
}
const animIdSet = new Set();
for (const entry of animDefs) {
  if (animIdSet.has(entry.type)) {
    console.error(`[gen-scene-dsl] Duplicate animation type: ${entry.type}`);
    process.exit(1);
  }
  animIdSet.add(entry.type);
}

const canonicalizeComponentName = (raw) => {
  const cleaned = raw
    .replace(/^mixamorig:/i, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!cleaned) return 'Part';
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const name = parts
    .map((part) => {
      if (!part) return '';
      const isAllCaps = part === part.toUpperCase() && part !== part.toLowerCase();
      const normalized = isAllCaps ? part.toLowerCase() : part;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join('');
  const safe = name.match(/^[A-Za-z_]/) ? name : `Part${name}`;
  return safe || 'Part';
};
const makeUnion = (values) => {
  if (!values.length) return 'string';
  return values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(' | ');
};

const modelTypeUnion = makeUnion(modelDefs.map((m) => m.type));
const animationTypeUnion = makeUnion(animDefs.map((a) => a.type));
const containedTypeUnion = makeUnion(containedDefs.map((c) => c.type));
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
const DEFAULT_MODEL_SCALE = 0.1;
const DEFAULT_MODEL_POSITION = [0, 0, 0];
const DEFAULT_MODEL_ROTATION = [0, 0, 0];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const toHex = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
const rgbaToHex = (rgba) => `#${toHex(rgba[0] ?? 1)}${toHex(rgba[1] ?? 1)}${toHex(rgba[2] ?? 1)}`;

const resolveMeshDefaults = (mesh) => {
  const primitives = mesh.listPrimitives();
  let material = null;
  for (const prim of primitives) {
    material = prim.getMaterial();
    if (material) break;
  }
  if (!material) {
    return { color: '#ffffff', metalness: 1, roughness: 1 };
  }
  const baseColor = material.getBaseColorFactor();
  const alphaMode = material.getAlphaMode?.() ?? 'OPAQUE';
  const opacity = alphaMode === 'BLEND' ? baseColor[3] : undefined;
  return {
    color: rgbaToHex(baseColor ?? [1, 1, 1, 1]),
    opacity,
    metalness: material.getMetallicFactor?.() ?? 1,
    roughness: material.getRoughnessFactor?.() ?? 1,
  };
};
const normalizePartName = (name) =>
  name.replace(/^mixamorig:/i, '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
for (const entry of modelDefs) {
  const root = await readGlb(entry.path);
  const nodes = root.listNodes();
  const bones = Array.from(new Set(
    root.listSkins().flatMap((skin) => skin.listJoints().map((joint) => joint.getName())),
  ))
    .filter(Boolean)
    .sort();
  const meshes = root.listMeshes().map((m) => m.getName()).filter(Boolean).sort();
  const nodeNames = nodes.map((n) => n.getName()).filter(Boolean);
  const anchorCandidates = Array.from(new Set([...bones, ...nodeNames, ...meshes])).sort();
  const anchorTargets = {};
  for (const anchorKey of entry.anchorKeys ?? []) {
    anchorTargets[anchorKey] = resolveAnchorTarget(anchorKey, anchorCandidates);
  }
  const meshDefaults = new Map();
  for (const mesh of root.listMeshes()) {
    const name = mesh.getName();
    if (!name || meshDefaults.has(name)) continue;
    meshDefaults.set(name, resolveMeshDefaults(mesh));
  }

  const bodyPartOverrides = {};
  for (const bone of bones) {
    bodyPartOverrides[bone] = { targetKind: 'bone' };
  }
  for (const mesh of meshes) {
    const defaults = meshDefaults.get(mesh) ?? { color: '#ffffff', metalness: 1, roughness: 1 };
    bodyPartOverrides[mesh] = {
      targetKind: 'mesh',
      color: defaults.color,
      opacity: defaults.opacity,
      metalness: defaults.metalness,
      roughness: defaults.roughness,
    };
  }

  const identity = {
    model: {
      scale: DEFAULT_MODEL_SCALE,
      position: [...DEFAULT_MODEL_POSITION],
      rotation: [...DEFAULT_MODEL_ROTATION],
      enabled: true,
      bodyPartOverrides,
    },
    playback: {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
      },
      animation: {
        enabled: false,
      },
    },
  };

  modelRegistry[entry.type] = {
    type: entry.type,
    glb: entry.path,
    bones,
    meshes,
    anchorTargets,
    bodyParts: Array.from(new Set([...bones, ...meshes])).sort(),
    identity,
  };
  modelBodyParts[entry.type] = Array.from(new Set([...bones, ...meshes])).sort();
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
  containedRegistry[entry.type] = {
    type: entry.type,
    glb: entry.path,
    subparts,
  };
  containedSubparts[entry.type] = subparts;
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
  animationRegistry[entry.type] = {
    type: entry.type,
    glb: entry.path,
    clipName,
    duration: animationDuration(chosen),
  };
}

const resourceOutput = `/* eslint-disable */\n// Auto-generated by scripts/gen-scene-dsl.mjs.\n\nexport type ModelType = ${modelTypeUnion};\nexport type AnimationType = ${animationTypeUnion};\nexport type ContainedModelType = ${containedTypeUnion};\n${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};\n` : ''}\n`;

const modelBodyPartTypes = modelDefs.map((entry) => {
  const name = entry.type;
  const typeName = `${name}BodyPart`;
  const union = makeUnion(modelBodyParts[entry.type] ?? []);
  return `export type ${typeName} = ${union};`;
}).join('\n');

const containedSubpartTypes = containedDefs.map((entry) => {
  const name = entry.type;
  const typeName = `${name}Subpart`;
  const union = makeUnion(containedSubparts[entry.type] ?? []);
  return `export type ${typeName} = ${union};`;
}).join('\n');

const toRelative = (abs) => {
  const rel = path.relative(absOutDir, abs).replaceAll(path.sep, '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
};

const modelDslImportPath = '@brewsite/core';

const modelBodyPartComponents = modelDefs.map((entry) => {
  const modelName = entry.type;
  const bones = modelRegistry[entry.type]?.bones ?? [];
  const meshes = modelRegistry[entry.type]?.meshes ?? [];
  const parts = [
    ...bones.map((id) => ({ id, kind: 'bone' })),
    ...meshes.map((id) => ({ id, kind: 'mesh' })),
  ];
  const grouped = new Map();
  for (const part of parts) {
    const normalized = normalizePartName(part.id);
    const displayName = part.id.replace(/^mixamorig:/i, '');
    if (!grouped.has(normalized)) {
      grouped.set(normalized, { normalized, displayName, bones: [], meshes: [] });
    }
    const group = grouped.get(normalized);
    if (!group.displayName) group.displayName = displayName;
    if (part.kind === 'bone') {
      group.bones.push(part.id);
    } else {
      group.meshes.push(part.id);
    }
  }
  const seen = new Set();
  const entries = [];
  const addComponent = (baseName, partId, kind, index = 0) => {
    let componentName = baseName;
    if (index > 0) componentName = `${baseName}${index + 1}`;
    if (seen.has(componentName)) {
      let suffix = 2;
      while (seen.has(`${componentName}${suffix}`)) suffix += 1;
      componentName = `${componentName}${suffix}`;
    }
    seen.add(componentName);
    entries.push(`  ${componentName}: (props: BodyPartProps) => (
    <BodyPart {...props} id=${JSON.stringify(partId)} targetKind=${JSON.stringify(kind)} />
  )`);
  };
  for (const group of grouped.values()) {
    const partName = canonicalizeComponentName(group.displayName ?? group.normalized);
    const baseName = `${partName}`;
    if (group.bones.length && group.meshes.length) {
      group.bones.forEach((id, idx) => addComponent(baseName, id, 'bone', idx));
      group.meshes.forEach((id, idx) => addComponent(`${baseName}Mesh`, id, 'mesh', idx));
    } else if (group.bones.length) {
      group.bones.forEach((id, idx) => addComponent(baseName, id, 'bone', idx));
    } else {
      group.meshes.forEach((id, idx) => addComponent(baseName, id, 'mesh', idx));
    }
  }
  const propsName = `${modelName}ModelProps`;
  return `export type ${propsName} = Omit<ModelProps, 'type'>;
export const ${modelName} = Object.assign(
  (props: ${propsName}) => (
    <ModelRouter {...props} type=${JSON.stringify(entry.type)} />
  ),
  {
${entries.length ? entries.join(',\n') : '  '}
  },
);
`;
}).filter(Boolean).join('\n\n');

const dslOutput = `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

import type {
  ModelProps,
  BodyPartProps,
  BodyPartByIdProps,
  PoseProps,
  ModelPartProps,
  ContainedModelProps,
  SubpartProps,
  PlaybackProps,
  MotionProps,
  AnimationProps,
} from '${modelDslImportPath}';
import {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '${modelDslImportPath}';

export type {
  ModelProps,
  BodyPartProps,
  BodyPartByIdProps,
  PoseProps,
  ModelPartProps,
  ContainedModelProps,
  SubpartProps,
  PlaybackProps,
  MotionProps,
  AnimationProps,
};

export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
};

export type ModelType = ${modelTypeUnion};
export type AnimationType = ${animationTypeUnion};
export type ContainedModelType = ${containedTypeUnion};
${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};
` : ''}

${modelBodyPartTypes}

${containedSubpartTypes}

export type ModelDslProps = Omit<ModelProps, 'id' | 'type'> & { id: string; type: ModelType };
export type AnimationDslProps = Omit<AnimationProps, 'clipName'> & { clipName?: AnimationType };
export type BodyPartDslProps<TBodyPartId extends string = string> = Omit<BodyPartByIdProps, 'id'> & { id: TBodyPartId };
export type ContainedModelDslProps = Omit<ContainedModelProps, 'modelId'> & { modelId: ContainedModelType };
export type SubpartDslProps<TSubpartId extends string = string> = Omit<SubpartProps, 'id'> & { id: TSubpartId };

${modelBodyPartComponents}
`;
await mkdir(absOutDir, { recursive: true });
await writeFile(path.join(absOutDir, 'siteResources.generated.ts'), `${resourceOutput}\n${modelBodyPartTypes}\n\n${containedSubpartTypes}\n`, 'utf8');
await writeFile(path.join(absOutDir, 'sceneDsl.generated.tsx'), dslOutput, 'utf8');
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'siteResources.generated.ts')}`);
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
  const publicAssets = path.resolve(ROOT, 'public', 'assets', 'scene-manifest.json');
  const publicRoot = path.resolve(ROOT, 'public', 'scene-manifest.json');
  if (path.resolve(absManifestOut) === publicAssets) {
    await writeFile(publicRoot, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[gen-scene-dsl] Wrote ${publicRoot}`);
  }
}
