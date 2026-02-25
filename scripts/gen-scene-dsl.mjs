/**
 * gen-scene-dsl.mjs
 *
 * CLI:
 *   node scripts/gen-scene-dsl.mjs --input <siteResources.ts> --out-dir <dir> [--manifest-out <path>] [--page-ids a,b]
 *
 * Reads a siteResources object export and generates typed DSL wrappers and a
 * version-2 AssetManifest JSON (defaults to public/assets/scene-manifest.json).
 */

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';

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
const assetRoot = getArg('--asset-root');
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

    switch (node.type) {
        case 'ParenthesizedExpression':
            return unwrapExpression(node.expression);
        case 'TSAsExpression':
            return unwrapExpression(node.expression);
        case 'TSNonNullExpression':
            return unwrapExpression(node.expression);
        case 'ChainExpression':
            return unwrapExpression(node.expression);
        case 'SequenceExpression':
            return unwrapExpression(node.expressions[node.expressions.length - 1]);
        case 'MemberExpression':
            return unwrapExpression(node.object);
        case 'OptionalMemberExpression':
            return unwrapExpression(node.object);
        case 'CallExpression':
            return unwrapExpression(node.callee);
        case 'OptionalCallExpression':
            return unwrapExpression(node.callee);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return unwrapExpression(node.left);
        case 'ConditionalExpression':
            return unwrapExpression(node.test);
        case 'AssignmentExpression':
            return unwrapExpression(node.left);
        case 'UpdateExpression':
        case 'UnaryExpression':
            return unwrapExpression(node.argument);
        case 'AwaitExpression':
            return unwrapExpression(node.argument);
        case 'TSInstantiationExpression':
            return unwrapExpression(node.expression);
        default:
            return node;
    }
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

const isNumberLiteral = (node) => {
    if (!node) return false;
    if (node.type === 'NumericLiteral') return typeof node.value === 'number';
    // ESTree (espree / acorn)
    if (node.type === 'Literal') return typeof node.value === 'number';
    return false;
};

const evalNumberExpression = (node, name) => {
    let unwrapped = node;
    while (unwrapped) {
        if (unwrapped.type === 'ParenthesizedExpression') {
            unwrapped = unwrapped.expression;
            continue;
        }
        if (unwrapped.type === 'TSAsExpression') {
            unwrapped = unwrapped.expression;
            continue;
        }
        if (unwrapped.type === 'TSNonNullExpression') {
            unwrapped = unwrapped.expression;
            continue;
        }
        if (unwrapped.type === 'ChainExpression') {
            unwrapped = unwrapped.expression;
            continue;
        }
        break;
    }
    if (!unwrapped) return null;

    if (isNumberLiteral(unwrapped)) return unwrapped.value;

    if (unwrapped.type === 'Identifier') {
        if (unwrapped.name === 'Infinity') return Infinity;
        if (unwrapped.name === 'NaN') return NaN;
        return null;
    }

    if (unwrapped.type === 'MemberExpression') {
        if (
            unwrapped.object?.type === 'Identifier' &&
            unwrapped.object.name === 'Math' &&
            unwrapped.property?.type === 'Identifier'
        ) {
            const key = unwrapped.property.name;
            if (Object.prototype.hasOwnProperty.call(Math, key) && typeof Math[key] === 'number') {
                return Math[key];
            }
        }
        return null;
    }

    if (unwrapped.type === 'UnaryExpression') {
        if (unwrapped.operator === '+') return evalNumberExpression(unwrapped.argument, name);
        if (unwrapped.operator === '-') {
            const value = evalNumberExpression(unwrapped.argument, name);
            return typeof value === 'number' ? -value : null;
        }
    }

    if (unwrapped.type === 'BinaryExpression') {
        const left = evalNumberExpression(unwrapped.left, name);
        const right = evalNumberExpression(unwrapped.right, name);
        if (typeof left !== 'number' || typeof right !== 'number') return null;
        switch (unwrapped.operator) {
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            case '/':
                return right === 0 ? null : left / right;
            case '%':
                return right === 0 ? null : left % right;
            case '**':
                return left ** right;
            default:
                return null;
        }
    }

    return null;
};

const readNumberLiteral = (node, name) => {
    const value = evalNumberExpression(node, name);
    if (typeof value === 'number') return value;
    const unwrapped = unwrapExpression(node);
    console.error(`[gen-scene-dsl] Invalid number literal: ${unwrapped?.type ?? 'unknown'}`);
    throw new Error(`Attribute ${name} must be a number literal.`);
};

const readStringProp = (obj, name, {required = false} = {}) => {
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

const readNumberProp = (obj, name, {required = false} = {}) => {
    const prop = getObjectProp(obj, name);
    if (!prop) {
        if (required) throw new Error(`Missing required attribute: ${name}`);
        return null;
    }
    if (prop.type !== 'ObjectProperty') {
        if (required) throw new Error(`Invalid attribute: ${name}`);
        return null;
    }
    return readNumberLiteral(prop.value, name);
};

const readStringArrayProp = (obj, name, {required = false} = {}) => {
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

const readNumberArrayProp = (obj, name, {required = false, length} = {}) => {
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
        throw new Error(`Attribute ${name} must be an array of number literals.`);
    }
    const values = value.elements.map((el, idx) => {
        if (!el) throw new Error(`Attribute ${name}[${idx}] is missing`);
        return readNumberLiteral(el, `${name}[${idx}]`);
    });
    if (typeof length === 'number' && values.length !== length) {
        throw new Error(`Attribute ${name} must have length ${length}.`);
    }
    return values;
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

const toPascalCase = (value) => {
    if (!value) return '';
    const parts = String(value)
        .replace(/[_-]+/g, ' ')
        .replace(/[^A-Za-z0-9 ]+/g, ' ')
        .split(' ')
        .filter(Boolean);
    if (!parts.length) return '';
    const name = parts.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join('');
    if (!name) return '';
    if (/^[0-9]/.test(name)) return `Subpart${name}`;
    if (RESERVED_TYPE_NAMES.has(name)) return `Subpart${name}`;
    return name;
};

const ensureUniqueName = (baseName, seen) => {
    if (!seen.has(baseName)) {
        seen.add(baseName);
        return baseName;
    }
    let suffix = 2;
    while (seen.has(`${baseName}${suffix}`)) suffix += 1;
    const name = `${baseName}${suffix}`;
    seen.add(name);
    return name;
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

const readContainedModelsProp = (obj) => {
    const prop = getObjectProp(obj, 'containedModels');
    if (!prop || prop.type !== 'ObjectProperty') return [];
    const value = unwrapExpression(prop.value);
    if (!value || value.type !== 'ArrayExpression') return [];
    const entries = [];
    for (const entry of value.elements.filter(Boolean)) {
        const entryObj = getObjectLiteral(unwrapExpression(entry));
        if (!entryObj) continue;
        const type = readStringProp(entryObj, 'type', {required: true});
        const target = readStringProp(entryObj, 'target', {required: false});
        const position = readNumberArrayProp(entryObj, 'position', {required: false, length: 3});
        const rotation = readNumberArrayProp(entryObj, 'rotation', {required: false, length: 3});
        const scale = readNumberProp(entryObj, 'scale', {required: false});
        if (!type) throw new Error('Missing required type on containedModel definition.');
        assertValidTypeName(type, 'containedModel.type');
        entries.push({
            type,
            ...(target ? {target} : {}),
            ...(position ? {position} : {}),
            ...(rotation ? {rotation} : {}),
            ...(typeof scale === 'number' ? {scale} : {}),
        });
    }
    return entries;
};

const modelDefs = [];
const animDefs = [];
const allowedRoles = new Set(['primary', 'brain', 'attachment', 'unknown']);

try {
    const modelNodes = getArrayProp(resourcesObj, 'models');
    for (const entry of modelNodes) {
        const obj = getObjectLiteral(unwrapExpression(entry));
        if (!obj) continue;
        const type = readStringProp(obj, 'type', {required: true});
        const pathValue = readStringProp(obj, 'path', {required: true});
        const role = readStringProp(obj, 'role', {required: true});
        const anchorKeys = readStringArrayProp(obj, 'anchorKeys', {required: false}) ?? [];
        const footOffsetY = readNumberProp(obj, 'footOffsetY', {required: false});
        const scale = readNumberProp(obj, 'scale', {required: false});
        const baseRotation = readNumberArrayProp(obj, 'baseRotation', {required: false, length: 3});
        const containedModels = readContainedModelsProp(obj);
        if (!type || !pathValue || !role) throw new Error('Missing required attributes on model definition.');
        assertValidTypeName(type, 'model.type');
        if (!allowedRoles.has(role)) {
            throw new Error(`Invalid role "${role}". Expected one of: ${Array.from(allowedRoles).join(', ')}`);
        }
        if (!pathValue.startsWith('/assets/')) {
            throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
        }
        modelDefs.push({
            type,
            path: pathValue,
            role,
            anchorKeys,
            footOffsetY,
            ...(typeof scale === 'number' ? {scale} : {}),
            ...(baseRotation ? {baseRotation} : {}),
            containedModels,
        });
    }

    const animNodes = getArrayProp(resourcesObj, 'animations');
    for (const entry of animNodes) {
        const obj = getObjectLiteral(unwrapExpression(entry));
        if (!obj) continue;
        const type = readStringProp(obj, 'type', {required: true});
        const pathValue = readStringProp(obj, 'path', {required: true});
        const clipName = readStringProp(obj, 'clipName', {required: false});
        const clipStart = readNumberProp(obj, 'clipStart', {required: false});
        const clipEnd = readNumberProp(obj, 'clipEnd', {required: false});
        if (!type || !pathValue) throw new Error('Missing required attributes on animation definition.');
        assertValidTypeName(type, 'animation.type');
        if (!pathValue.startsWith('/assets/')) {
            throw new Error(`Invalid path "${pathValue}". Expected to start with /assets/.`);
        }
        animDefs.push({
            type,
            path: pathValue,
            clipName: clipName ?? null,
            ...(typeof clipStart === 'number' ? {clipStart} : {}),
            ...(typeof clipEnd === 'number' ? {clipEnd} : {}),
        });
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
const animIdSet = new Set();
for (const entry of animDefs) {
    if (animIdSet.has(entry.type)) {
        console.error(`[gen-scene-dsl] Duplicate animation type: ${entry.type}`);
        process.exit(1);
    }
    animIdSet.add(entry.type);
}

const modelTypeSet = new Set(modelDefs.map((entry) => entry.type));
const containedTypeSet = new Set();
for (const entry of modelDefs) {
    const contained = entry.containedModels ?? [];
    for (const containedEntry of contained) {
        if (!modelTypeSet.has(containedEntry.type)) {
            console.error(
                `[gen-scene-dsl] Unknown contained model type "${containedEntry.type}" on model "${entry.type}".`,
            );
            process.exit(1);
        }
        if (containedEntry.target) {
            const anchors = entry.anchorKeys ?? [];
            if (!anchors.includes(containedEntry.target)) {
                console.error(
                    `[gen-scene-dsl] Invalid containedModel.target "${containedEntry.target}" on model "${entry.type}". ` +
                    `Expected one of: ${anchors.join(', ') || '(none)'}`,
                );
                process.exit(1);
            }
        }
        containedTypeSet.add(containedEntry.type);
    }
}

const canonicalizeComponentName = (raw) => {
    const cleaned = raw
        .replace(/^mixamorig:/i, '')
        .replace(/^cc_base_/i, '')
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
const containedTypeUnion = makeUnion(Array.from(containedTypeSet).sort());
const pageIds = pageIdsArg ? pageIdsArg.split(',').map((v) => v.trim()).filter(Boolean) : [];
const scenePageIdUnion = makeUnion(pageIds);

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

const resolveAnchorTarget = (key, bones, nodes, meshes) => {
    const lowerKey = key.toLowerCase();
    const findIn = (list) => {
        const exact = list.find((n) => n.toLowerCase() === lowerKey);
        if (exact) return exact;
        const suffix = list.find((n) => n.toLowerCase().endsWith(`:${lowerKey}`));
        if (suffix) return suffix;
        const contains = list.find((n) => {
            const lower = n.toLowerCase();
            return lower.includes(lowerKey) && !lower.includes('end');
        });
        if (contains) return contains;
        return null;
    };
    return findIn(bones) ?? findIn(nodes) ?? findIn(meshes) ?? null;
};

const modelRegistry = {};
const modelBodyParts = {};
const containedSubparts = {};
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
        return {color: '#ffffff', metalness: 1, roughness: 1};
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

const computeFootOffsetY = (root) => {
    let minY = Infinity;
    const world = new Float32Array(16);
    for (const node of root.listNodes()) {
        const mesh = node.getMesh?.();
        if (!mesh) continue;
        node.getWorldMatrix(world);
        for (const prim of mesh.listPrimitives()) {
            const position = prim.getAttribute?.('POSITION');
            if (!position) continue;
            const array = position.getArray?.();
            if (!array || array.length < 3) continue;
            for (let i = 0; i < array.length; i += 3) {
                const x = array[i] ?? 0;
                const y = array[i + 1] ?? 0;
                const z = array[i + 2] ?? 0;
                const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
                if (wy < minY) minY = wy;
            }
        }
    }
    return Number.isFinite(minY) ? minY : 0;
};
// ─── Canonical body part matching helpers ────────────────────────────────────

/**
 * Tokenizes a bone or mesh name into lowercase word tokens.
 * Handles:
 * - mixamorig: prefix stripping
 * - camelCase boundary splitting
 * - non-alphanumeric separator splitting
 * - numeric normalization ('01' → '1')
 */
const SIDE_TOKENS = new Set(['left', 'right']);

/**
 * Converts a gltf-transform bone name to the Three.js runtime name.
 * Three.js GLTF loader strips the colon from the mixamorig: prefix:
 *   "mixamorig:RightForeArm" → "mixamorigRightForeArm"
 * The boneId stored in the DSL/manifest must match what Three.js puts in
 * boneByName at runtime.
 */
const toThreeJsBoneName = (name) => name.replace(/^(mixamorig):/i, '$1');

const tokenizeName = (name) => {
    // Strip mixamorig prefix (with or without colon — handles both gltf-transform
    // and Three.js runtime formats for canonical matching robustness)
    name = name.replace(/^mixamorig:?/i, '');
    // Insert _ at camelCase boundaries
    name = name.replace(/([a-z])([A-Z])/g, '$1_$2');
    name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');
    // Split on non-alphanumeric, lowercase, normalize numerics
    const raw = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
    const tokens = raw.map((t) => {
        const lower = t.toLowerCase();
        return /^\d+$/.test(lower) ? String(parseInt(lower, 10)) : lower;
    }).filter(Boolean);
    if (tokens[0] === 'cc' && tokens[1] === 'base') {
        tokens.splice(0, 2);
    }
    return tokens.map((t) => (t === 'l' ? 'left' : t === 'r' ? 'right' : t));
};

/**
 * Produces a canonical key '{side}::{base}' for matching bones to meshes.
 * side = first token that is 'left' or 'right' (null if none)
 * base = all non-side tokens joined (no separator)
 */
const canonicalKey = (name) => {
    const tokens = tokenizeName(name);
    const side = tokens.find((t) => SIDE_TOKENS.has(t)) ?? null;
    const base = tokens.filter((t) => !SIDE_TOKENS.has(t)).join('');
    return `${side ?? ''}::${base}`;
};

/**
 * Groups bones and meshes into canonical BodyPartGroups using bag-of-words
 * matching. A bone and mesh with the same {side, base} canonical key form one
 * unified group (linked). Unmatched bones or meshes form their own groups.
 */
const buildBodyPartGroups = (bones, meshes) => {
    const groups = new Map(); // canonicalKey → { displayName, bones[], meshes[] }
    for (const bone of bones) {
        const k = canonicalKey(bone); // canonical key uses gltf-transform name (colon stripped internally)
        if (!groups.has(k)) {
            const displayName = bone.replace(/^mixamorig:/i, '');
            groups.set(k, {displayName, bones: [], meshes: []});
        }
        // Store Three.js-compatible name (colon stripped) so boneId values match
        // what Three.js puts in boneByName when traversing the loaded GLB.
        groups.get(k).bones.push(toThreeJsBoneName(bone));
    }
    for (const mesh of meshes) {
        const k = canonicalKey(mesh);
        if (!groups.has(k)) {
            groups.set(k, {displayName: mesh, bones: [], meshes: []});
        }
        groups.get(k).meshes.push(mesh);
    }
    return Array.from(groups.values()).map((g) => ({
        name: canonicalizeComponentName(g.displayName),
        boneIds: g.bones,
        meshIds: g.meshes,
    }));
};

/**
 * Builds the identity bodyPartOverrides from BodyPartGroups.
 * - Bone-only groups: no entry (no material defaults to set)
 * - Mesh-only groups: use mesh name as key (legacy compat), set targetKind='mesh'
 * - Linked groups (bone+mesh): use canonical name as key, embed meshId + boneId
 */
const buildIdentity = (bodyPartGroups, meshDefaults) => {
    const bodyPartOverrides = {};
    for (const group of bodyPartGroups) {
        const firstMeshId = group.meshIds[0] ?? null;
        const firstBoneId = group.boneIds[0] ?? null;
        if (!firstMeshId) continue; // bone-only: no material to default
        const defaults = meshDefaults.get(firstMeshId) ?? {color: '#ffffff', metalness: 1, roughness: 1};
        const isLinked = firstBoneId !== null;
        const key = isLinked ? group.name : firstMeshId;
        bodyPartOverrides[key] = {
            ...(defaults.color !== undefined ? {color: defaults.color} : {}),
            ...(defaults.opacity !== undefined ? {opacity: defaults.opacity} : {}),
            ...(defaults.metalness !== undefined ? {metalness: defaults.metalness} : {}),
            ...(defaults.roughness !== undefined ? {roughness: defaults.roughness} : {}),
            ...(isLinked ? {meshId: firstMeshId, boneId: firstBoneId} : {targetKind: 'mesh'}),
        };
    }
    return {
        model: {
            scale: DEFAULT_MODEL_SCALE,
            position: [...DEFAULT_MODEL_POSITION],
            rotation: [...DEFAULT_MODEL_ROTATION],
            enabled: true,
            bodyPartOverrides,
        },
        playback: {
            motion: {commands: [], scenes: [], customAnimations: []},
            animation: {enabled: false},
        },
    };
};

const buildContainedParts = (defs) => {
    const parts = {};
    for (const entry of defs) {
        if (!entry?.target) continue;
        const position = entry.position ?? [0, 0, 0];
        const rotation = entry.rotation ?? [0, 0, 0];
        const scale = typeof entry.scale === 'number' ? entry.scale : 1;
        parts[entry.type] = {
            id: entry.type,
            anchor: entry.target,
            enabled: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            containedPosition: position,
            containedRotation: rotation,
            containedScale: scale,
            modelId: entry.type,
        };
    }
    return Object.keys(parts).length > 0 ? parts : null;
};

for (const entry of modelDefs) {
    const root = await readGlb(entry.path);
    const nodes = root.listNodes();
    const bones = Array.from(new Set(
        root.listSkins().flatMap((skin) => skin.listJoints().map((joint) => joint.getName())),
    ))
        .filter(Boolean)
        .sort();
    const meshes = root.listMeshes().map((m) => m.getName()).filter(Boolean).sort();
    const subparts = nodes
        .filter((n) => n.getMesh && n.getMesh())
        .map((n) => n.getName())
        .filter(Boolean)
        .sort();
    if (containedTypeSet.has(entry.type)) {
        containedSubparts[entry.type] = subparts;
    }
    const nodeNames = nodes.map((n) => n.getName()).filter(Boolean);
    const anchorCandidates = Array.from(new Set([...bones, ...nodeNames, ...meshes])).sort();
    const anchorTargets = {};
    for (const anchorKey of entry.anchorKeys ?? []) {
        const resolved = resolveAnchorTarget(anchorKey, bones, nodeNames, meshes);
        if (!resolved) {
            console.error(
                `[gen-scene-dsl] Invalid anchorKey "${anchorKey}" for model "${entry.type}". ` +
                `Expected one of: ${anchorCandidates.join(', ') || '(none)'}`,
            );
            process.exit(1);
        }
        anchorTargets[anchorKey] = toThreeJsBoneName(resolved);
    }
    const meshDefaults = new Map();
    for (const mesh of root.listMeshes()) {
        const name = mesh.getName();
        if (!name || meshDefaults.has(name)) continue;
        meshDefaults.set(name, resolveMeshDefaults(mesh));
    }

    const bodyPartGroups = buildBodyPartGroups(bones, meshes);
    const identity = buildIdentity(bodyPartGroups, meshDefaults);
    if (typeof entry.scale === 'number') {
        identity.model.scale = entry.scale;
    }
    const bakedParts = buildContainedParts(entry.containedModels ?? []);
    if (bakedParts) {
        identity.model.parts = bakedParts;
    }
    const computedFootOffsetY = computeFootOffsetY(root);
    const footOffsetDeltaY = typeof entry.footOffsetY === 'number' ? entry.footOffsetY : 0;
    const footOffsetY = computedFootOffsetY + footOffsetDeltaY;
    if (Number.isFinite(computedFootOffsetY)) {
        console.log('[gen-scene-dsl] footOffsetY', {
            type: entry.type,
            computed: computedFootOffsetY,
            delta: footOffsetDeltaY,
            final: footOffsetY,
        });
    }

    modelRegistry[entry.type] = {
        type: entry.type,
        glb: entry.path,
        bones,
        meshes,
        anchorTargets,
        bodyParts: Array.from(new Set([...bones, ...meshes])).sort(),
        bodyPartGroups,
        identity,
        ...(entry.baseRotation ? {baseRotation: entry.baseRotation} : {}),
        ...(containedTypeSet.has(entry.type) ? {subparts} : {}),
        ...(Number.isFinite(footOffsetY) ? {footOffsetY} : {}),
    };
    modelBodyParts[entry.type] = Array.from(new Set([...bones, ...meshes])).sort();
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
        ...(typeof entry.clipStart === 'number' ? {clipStart: entry.clipStart} : {}),
        ...(typeof entry.clipEnd === 'number' ? {clipEnd: entry.clipEnd} : {}),
    };
}

const resourceOutput = `/* eslint-disable */\n// Auto-generated by scripts/gen-scene-dsl.mjs.\n\nexport type ModelType = ${modelTypeUnion};\nexport type AnimationType = ${animationTypeUnion};\nexport type ContainedModelType = ${containedTypeUnion};\n${pageIds.length ? `export type ScenePageId = ${scenePageIdUnion};\n` : ''}\n`;

const modelBodyPartTypes = modelDefs.map((entry) => {
    const name = entry.type;
    const typeName = `${name}BodyPart`;
    const union = makeUnion(modelBodyParts[entry.type] ?? []);
    return `export type ${typeName} = ${union};`;
}).join('\n');

const containedTypeList = Array.from(containedTypeSet).sort();
const containedSubpartTypes = containedTypeList.map((type) => {
    const name = type;
    const typeName = `${name}Subpart`;
    const union = makeUnion(containedSubparts[type] ?? []);
    return {name, typeName, union};
});

const containedSubpartComponents = containedTypeList.map((type) => {
    const subparts = containedSubparts[type] ?? [];
    const containerName = `${toPascalCase(type) || type}Subparts`;
    const entries = [];
    const seen = new Set();
    for (const id of subparts) {
        const baseName = toPascalCase(id) || 'Subpart';
        const componentName = ensureUniqueName(baseName, seen);
        entries.push({
            name: componentName,
            render: `<Subpart {...props} id=${JSON.stringify(id)} />`,
        });
    }
    return {name: type, containerName, entries, hasEntries: entries.length > 0};
});

const toRelative = (abs) => {
    const rel = path.relative(absOutDir, abs).replaceAll(path.sep, '/');
    return rel.startsWith('.') ? rel : `./${rel}`;
};

const modelDslImportPath = '@brewsite/core';

const modelBodyPartComponents = modelDefs.map((entry) => {
    const modelName = entry.type;
    const bodyPartGroups = modelRegistry[entry.type]?.bodyPartGroups ?? [];
    const seen = new Set();
    const entries = [];
    const modelPartEntries = [];

    const partSeen = new Set();
    for (const def of entry.containedModels ?? []) {
        if (!def?.target) continue;
        const baseName = toPascalCase(def.type) || def.type;
        const componentName = ensureUniqueName(baseName, partSeen);
        const subpartsContainerName = `${toPascalCase(def.type) || def.type}Subparts`;
        const subpartsPropsTypeName = `${toPascalCase(def.type) || def.type}SubpartsProps`;
        const containedPosition = def.position ?? null;
        const containedRotation = def.rotation ?? null;
        const containedScale = typeof def.scale === 'number' ? def.scale : null;
        modelPartEntries.push({
            name: componentName,
            id: def.type,
            target: def.target,
            containedPosition,
            containedRotation,
            containedScale,
            subpartsContainerName,
            subpartsPropsTypeName,
        });
    }

    for (const group of bodyPartGroups) {
        const firstBoneId = group.boneIds[0] ?? null;
        const firstMeshId = group.meshIds[0] ?? null;
        const isLinked = firstBoneId !== null && firstMeshId !== null;
        const isMeshOnly = firstBoneId === null && firstMeshId !== null;
        const isBoneOnly = firstBoneId !== null && firstMeshId === null;

        if (isLinked) {
            // Unified component: routes color/opacity/metalness/roughness to mesh,
            // pose to bone — single authoring expression covers both
            const componentName = ensureUniqueName(group.name, seen);
            entries.push({
                name: componentName,
                render: `<BodyPart {...props} id=${JSON.stringify(group.name)} boneId=${JSON.stringify(firstBoneId)} meshId=${JSON.stringify(firstMeshId)} />`,
            });
            // Additional meshes in the group get their own mesh-only components
            for (let i = 1; i < group.meshIds.length; i++) {
                const extraName = ensureUniqueName(`${group.name}Mesh${i + 1}`, seen);
                entries.push({
                    name: extraName,
                    render: `<BodyPart {...props} id=${JSON.stringify(group.meshIds[i])} targetKind="mesh" />`,
                });
            }
            // Additional bones get their own bone-only components
            for (let i = 1; i < group.boneIds.length; i++) {
                const extraName = ensureUniqueName(`${group.name}Bone${i + 1}`, seen);
                entries.push({
                    name: extraName,
                    render: `<BodyPart {...props} id=${JSON.stringify(group.boneIds[i])} targetKind="bone" />`,
                });
            }
        } else if (isMeshOnly) {
            const componentName = ensureUniqueName(group.name, seen);
            entries.push({
                name: componentName,
                render: `<BodyPart {...props} id=${JSON.stringify(firstMeshId)} targetKind="mesh" />`,
            });
            for (let i = 1; i < group.meshIds.length; i++) {
                const extraName = ensureUniqueName(`${group.name}${i + 1}`, seen);
                entries.push({
                    name: extraName,
                    render: `<BodyPart {...props} id=${JSON.stringify(group.meshIds[i])} targetKind="mesh" />`,
                });
            }
        } else if (isBoneOnly) {
            const componentName = ensureUniqueName(group.name, seen);
            entries.push({
                name: componentName,
                render: `<BodyPart {...props} id=${JSON.stringify(firstBoneId)} targetKind="bone" />`,
            });
            for (let i = 1; i < group.boneIds.length; i++) {
                const extraName = ensureUniqueName(`${group.name}${i + 1}`, seen);
                entries.push({
                    name: extraName,
                    render: `<BodyPart {...props} id=${JSON.stringify(group.boneIds[i])} targetKind="bone" />`,
                });
            }
        }
    }

    const propsName = `${modelName}ModelProps`;
    const renderBodyPart = (entry) =>
        `const ${modelName}${entry.name} = (props: BodyPartProps) => (\n  ${entry.render}\n);`;
    const renderModelPart = (entry) => {
        const position = entry.containedPosition ? ` position={${JSON.stringify(entry.containedPosition)}}` : '';
        const rotation = entry.containedRotation ? ` rotation={${JSON.stringify(entry.containedRotation)}}` : '';
        const scale = typeof entry.containedScale === 'number' ? ` scale={${entry.containedScale}}` : '';
        return [
            `export type ${modelName}${entry.name}Children =`,
            `  | ReactElement<${entry.subpartsPropsTypeName}, typeof ${entry.subpartsContainerName}>;`,
            ``,
            `export type ${modelName}${entry.name}Props = Omit<ModelPartProps, 'id'> & {`,
            `  children?: ${modelName}${entry.name}Children | ${modelName}${entry.name}Children[];`,
            `};`,
            ``,
            `const ${modelName}${entry.name} = Object.assign(`,
            `  (props: ${modelName}${entry.name}Props) => {`,
            `    const { anchor, ...rest } = props;`,
            `    return (`,
            `      <ModelPart {...rest} id=${JSON.stringify(entry.id)} anchor={anchor ?? ${JSON.stringify(entry.target)}}>`,
            `        {props.children}`,
            `      </ModelPart>`,
            `    );`,
            `  },`,
            `  {`,
            `    Subparts: ${entry.subpartsContainerName},`,
            `  },`,
            `);`,
            ``,
        ].join('\n');
    };
    const bodyPartOutput = entries.map(renderBodyPart).join('\n');
    const modelPartOutput = modelPartEntries.map(renderModelPart).join('\n');
    return {
        modelName,
        propsName,
        entries,
        modelPartEntries,
        output: [
            `export type ${propsName} = Omit<ModelProps, 'type'>;`,
            ``,
            bodyPartOutput,
            ``,
            modelPartOutput,
            ``,
            `export type ${modelName}BodyPartElement = ${entries.length
                ? entries.map((entry) => `ReactElement<BodyPartProps, typeof ${modelName}${entry.name}>`).join(' | ')
                : 'ReactElement<BodyPartProps>'
            };`,
            ``,
            `export type ${modelName}BodyPartsProps = {`,
            `  children?: ${modelName}BodyPartElement | ${modelName}BodyPartElement[];`,
            `};`,
            ``,
            `const ${modelName}BodyParts = (props: ${modelName}BodyPartsProps) => (`,
            `  <BodyParts>{props.children}</BodyParts>`,
            `);`,
            ``,
            `export type ${modelName}ModelPartElement = ${modelPartEntries.length
                ? modelPartEntries.map((entry) => `ReactElement<${modelName}${entry.name}Props, typeof ${modelName}${entry.name}>`).join(' | ')
                : 'ReactElement<Omit<ModelPartProps, \"id\">>'
            };`,
            ``,
            `export type ${modelName}ModelPartsProps = {`,
            `  children?: ${modelName}ModelPartElement | ${modelName}ModelPartElement[];`,
            `};`,
            ``,
            `const ${modelName}ModelParts = (props: ${modelName}ModelPartsProps) => (`,
            `  <>{props.children}</>`,
            `);`,
            ``,
            `export const ${modelName} = Object.assign(`,
            `  (props: ${propsName}) => (`,
            `    <ModelRouter {...props} type=${JSON.stringify(entry.type)} />`,
            `  ),`,
            `  {`,
            `    BodyParts: ${modelName}BodyParts,`,
            `    ModelParts: ${modelName}ModelParts,`,
            entries.length
                ? entries.map((entry) => `    ${entry.name}: ${modelName}${entry.name}`).join(',\n')
                : '  ',
            modelPartEntries.length
                ? `,\n${modelPartEntries.map((entry) => `    ${entry.name}: ${modelName}${entry.name}`).join(',\n')}`
                : '',
            `  },`,
            `);`,
            ``,
        ].join('\n'),
    };
}).filter(Boolean);

const commonDslOutput = `/* eslint-disable */
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

export type ModelDslProps = Omit<ModelProps, 'id' | 'type'> & { id: string; type: ModelType };
export type AnimationDslProps = Omit<AnimationProps, 'clipName'> & { clipName?: AnimationType };
export type BodyPartDslProps<TBodyPartId extends string = string> = Omit<BodyPartByIdProps, 'id'> & { id: TBodyPartId };
export type ContainedModelDslProps = Omit<ContainedModelProps, 'modelId'> & { modelId: ContainedModelType };
export type SubpartDslProps<TSubpartId extends string = string> = Omit<SubpartProps, 'id'> & { id: TSubpartId };
`;

const modelDslOutputs = modelDefs.map((entry) => {
    const model = modelBodyPartComponents.find((m) => m.modelName === entry.type);
    const modelName = entry.type;
    const propsName = `${modelName}ModelProps`;
    return {
        fileName: `sceneDsl.${modelName}.generated.tsx`,
        output: `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

import type { ReactElement } from 'react';
import type { ModelProps, BodyPartProps, ModelPartProps } from './sceneDsl.common.generated';
import { ModelRouter, BodyPart, BodyParts, ModelPart, ContainedModel } from './sceneDsl.common.generated';
${model?.modelPartEntries?.map((entry) => `import type { ${entry.subpartsPropsTypeName} } from './sceneDsl.${entry.id}.subparts.generated';\nimport { ${entry.subpartsContainerName} } from './sceneDsl.${entry.id}.subparts.generated';`).join('\n') ?? ''}

${model?.output ?? `export type ${propsName} = Omit<ModelProps, 'type'>;
export const ${modelName} = Object.assign(
  (props: ${propsName}) => (
    <ModelRouter {...props} type=${JSON.stringify(entry.type)} />
  ),
  {
  },
);
`}
`,
    };
});

const containedDslOutputs = containedTypeList.map((type) => {
    const typeInfo = containedSubpartTypes.find((t) => t.name === type);
    const compInfo = containedSubpartComponents.find((c) => c.name === type);
    const typeName = typeInfo?.typeName ?? `${type}Subpart`;
    const union = typeInfo?.union ?? 'string';
    const containerName = compInfo?.containerName ?? `${toPascalCase(type) || type}Subparts`;
    const entries = compInfo?.entries ?? [];
    const typePrefix = toPascalCase(type) || type;
    return {
        fileName: `sceneDsl.${type}.subparts.generated.tsx`,
        output: `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

import type { ReactElement } from 'react';
import type { SubpartProps } from './sceneDsl.common.generated';
import { Subpart } from './sceneDsl.common.generated';

export type ${typeName} = ${union};

${entries.map((entry) => `const ${typePrefix}${entry.name} = (props: Omit<SubpartProps, 'id'>) => (\n  ${entry.render}\n);`).join('\n')}

export type ${typePrefix}SubpartElement = ${
            entries.length
                ? entries.map((entry) => `ReactElement<Omit<SubpartProps, 'id'>, typeof ${typePrefix}${entry.name}>`).join(' | ')
                : 'ReactElement<Omit<SubpartProps, \"id\">>'
        };

export type ${typePrefix}SubpartsProps = {
  children?: ${typePrefix}SubpartElement | ${typePrefix}SubpartElement[];
};

export const ${containerName} = Object.assign(
  (props: ${typePrefix}SubpartsProps) => <>{props.children}</>,
  {
${entries.length ? entries.map((entry) => `    ${entry.name}: ${typePrefix}${entry.name}`).join(',\n') : '  '}
  },
);
`,
    };
});

const indexDslOutput = `/* eslint-disable */
// Auto-generated by scripts/gen-scene-dsl.mjs.

export * from './sceneDsl.common.generated';
${modelDefs.map((entry) => `export * from './sceneDsl.${entry.type}.generated';`).join('\n')}
${containedTypeList.map((type) => `export * from './sceneDsl.${type}.subparts.generated';`).join('\n')}
`;
await mkdir(absOutDir, {recursive: true});
await writeFile(path.join(absOutDir, 'siteResources.generated.ts'), `${resourceOutput}\n${modelBodyPartTypes}\n\n${containedSubpartTypes.map((t) => `export type ${t.typeName} = ${t.union};`).join('\n')}\n`, 'utf8');
await writeFile(path.join(absOutDir, 'sceneDsl.common.generated.tsx'), commonDslOutput, 'utf8');
for (const model of modelDslOutputs) {
    await writeFile(path.join(absOutDir, model.fileName), model.output, 'utf8');
}
for (const contained of containedDslOutputs) {
    await writeFile(path.join(absOutDir, contained.fileName), contained.output, 'utf8');
}
await writeFile(path.join(absOutDir, 'sceneDsl.generated.tsx'), indexDslOutput, 'utf8');
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'siteResources.generated.ts')}`);
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneDsl.common.generated.tsx')}`);
for (const model of modelDslOutputs) {
    console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, model.fileName)}`);
}
for (const contained of containedDslOutputs) {
    console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, contained.fileName)}`);
}
console.log(`[gen-scene-dsl] Wrote ${path.join(absOutDir, 'sceneDsl.generated.tsx')}`);

if (absManifestOut) {
    const manifest = {
        version: 2,
        models: Object.values(modelRegistry),
        animations: Object.values(animationRegistry),
    };
    await mkdir(path.dirname(absManifestOut), {recursive: true});
    await writeFile(absManifestOut, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[gen-scene-dsl] Wrote ${absManifestOut}`);
    const publicAssets = path.resolve(ROOT, 'public', 'assets', 'scene-manifest.json');
    const publicRoot = path.resolve(ROOT, 'public', 'scene-manifest.json');
    if (path.resolve(absManifestOut) === publicAssets) {
        await writeFile(publicRoot, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        console.log(`[gen-scene-dsl] Wrote ${publicRoot}`);
    }
}
