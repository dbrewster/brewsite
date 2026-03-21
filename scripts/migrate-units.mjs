#!/usr/bin/env node
// Codemod: migrate bare-number DSL props to SceneLength/SceneAngle unit strings.
// Usage: node scripts/migrate-units.mjs [--dry-run] [file ...]
// If no files given, processes all .tsx files under apps/.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// ─── Prop Classification ────────────────────────────────────────────────────

// 'pct'   → position/bounds: multiply by 100, append '%' (0.5 → "50%")
// 'u'     → size/thickness: keep value, append 'u' (0.15 → "0.15u")
// 'rad'   → angle in radians: keep value, append 'rad' (0.15 → "0.15rad")
// 'deg'   → angle in degrees: keep value, append 'deg' (45 → "45deg")
// 'pct3'  → 3-tuple position: each element × 100 + '%' (includes Z for ScenePosition3)
// 'u2'    → 2-tuple size: each element + 'u'
// 'rad3'  → 3-tuple angle: each element + 'rad'

const COMPONENT_PROPS = {
  // ─── Diagram ────────────────────────────────────────────────────────────────
  Diagram: {
    x: 'pct', y: 'pct', w: 'pct', h: 'pct',
    tilt: 'rad',
  },
  DiagramNode: {
    position: 'pct3',
    size: 'u2',
    thickness: 'u',
    cornerRadius: 'u',
    borderWidth: 'u',
    borderHeight: 'u',
    iconDepth: 'u',
  },
  DiagramEdge: {
    thickness: 'u',
    flowTurnRadius: 'u',
    flowFaceStub: 'u',
  },
  DiagramExit: {
    to: 'pct3',
  },
  DiagramEnter: {
    from: 'pct3',
  },
  GridLayout: {
    spacing: 'pct2',
    margin: 'pct_or_pct2',
    groupPadding: 'pct_padding',
    titleGap: 'pct',
  },
  HierarchicalLayout: {
    spacing: 'pct2',
    margin: 'pct_or_pct2',
    groupPadding: 'pct_padding',
    titleGap: 'pct',
  },
  FlowLayout: {
    gap: 'pct',
    groupPadding: 'pct_padding',
    titleGap: 'pct',
  },
  ManualLayout: {
    groupPadding: 'pct_padding',
    titleGap: 'pct',
  },

  // ─── Chart ──────────────────────────────────────────────────────────────────
  BarChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },
  LineChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },
  AreaChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },
  PieChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },
  ScatterPlotChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },
  HeatMapChart: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', rotation: 'rad3' },

  // ─── View / ViewLayout ──────────────────────────────────────────────────────
  View: { x: 'pct', y: 'pct', w: 'pct', h: 'pct' },
  ViewLayout: { x: 'pct', y: 'pct', w: 'pct', h: 'pct', gap: 'pct' },

  // ─── TextBox ────────────────────────────────────────────────────────────────
  TextBox: { x: 'pct', y: 'pct', w: 'pct', h: 'pct' },

  // ─── Camera ─────────────────────────────────────────────────────────────────
  Camera: {
    fov: 'deg',
    azimuth: 'rad',
    polar: 'rad',
    // nvsTarget is [SceneLength, SceneLength] — handled specially
    nvsTarget: 'pct2',
  },

  // ─── Floor ──────────────────────────────────────────────────────────────────
  Floor: {
    rotation: 'rad3',
    rotationRelative: 'rad3',
    textureRotation: 'rad',
  },

  // ─── Screen / ImagePanel / MediaScreen ──────────────────────────────────────
  Screen: {
    x: 'pct', y: 'pct',
    width: 'u', height: 'u',
    rotation: 'rad3',
  },
  ImagePanel: {
    x: 'pct', y: 'pct',
    width: 'u', height: 'u',
    rotation: 'rad3',
  },
  MediaScreen: {
    x: 'pct', y: 'pct',
    width: 'u', height: 'u',
    rotation: 'rad3',
  },

  // ─── Model ──────────────────────────────────────────────────────────────────
  // NOTE: Model x, y, w, h are still `number` in the current DSL (not migrated).
  // Only rotation is migrated to SceneAngle.
  Model: {
    rotation: 'rad3',
  },

  // ─── SpotlightRig ──────────────────────────────────────────────────────────
  SpotlightRig: {
    angle: 'rad',
    phase: 'rad',
  },
  Spotlight: {
    angle: 'rad',
  },

  // ─── CarouselScrubber ──────────────────────────────────────────────────────
  CarouselScrubber: {
    outerMargin: 'pct',
  },

  // ─── CarouselTray ─────────────────────────────────────────────────────────
  CarouselTray: {
    outerMargin: 'pct',
  },
};

// ─── Value Formatting ───────────────────────────────────────────────────────

/** Format a number cleanly (no trailing zeros, max 6 decimal places). */
function fmtNum(n) {
  if (n === 0) return '0';
  // Use toPrecision to avoid floating point artifacts
  const s = Number(n.toPrecision(10)).toString();
  return s;
}

/** Convert a single number to a percentage string: 0.5 → "50%" */
function toPct(n) {
  if (n === 0) return '0';
  const pct = n * 100;
  return `${fmtNum(pct)}%`;
}

/** Convert a single number to a u string: 0.15 → "0.15u" */
function toU(n) {
  if (n === 0) return '0';
  return `${fmtNum(n)}u`;
}

/** Convert a single number to a rad string: 0.15 → "0.15rad" */
function toRad(n) {
  if (n === 0) return '0';
  return `${fmtNum(n)}rad`;
}

/** Convert a single number to a deg string: 45 → "45deg" */
function toDeg(n) {
  if (n === 0) return '0';
  return `${fmtNum(n)}deg`;
}

// ─── AST Helpers ────────────────────────────────────────────────────────────

/**
 * Evaluate a numeric expression from an AST node.
 * Returns { value: number } or null if not a static numeric expression.
 */
function evalNumericExpr(node, sourceFile) {
  if (!node) return null;

  // Numeric literal: 0.5, 42
  if (ts.isNumericLiteral(node)) {
    return { value: parseFloat(node.text) };
  }

  // Prefix unary: -0.5
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = evalNumericExpr(node.operand, sourceFile);
    if (inner) return { value: -inner.value };
  }

  // Simple binary: Math.PI / 12
  if (ts.isBinaryExpression(node)) {
    const left = evalNumericExpr(node.left, sourceFile);
    const right = evalNumericExpr(node.right, sourceFile);
    if (left && right) {
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.SlashToken: return right.value !== 0 ? { value: left.value / right.value } : null;
        case ts.SyntaxKind.AsteriskToken: return { value: left.value * right.value };
        case ts.SyntaxKind.PlusToken: return { value: left.value + right.value };
        case ts.SyntaxKind.MinusToken: return { value: left.value - right.value };
      }
    }
    return null;
  }

  // Property access: Math.PI
  if (ts.isPropertyAccessExpression(node)) {
    const text = node.getText(sourceFile);
    if (text === 'Math.PI') return { value: Math.PI };
  }

  // Parenthesized: (Math.PI / 12)
  if (ts.isParenthesizedExpression(node)) {
    return evalNumericExpr(node.expression, sourceFile);
  }

  return null;
}

/**
 * Check if a node is a reference to a variable/constant (identifier or property access)
 * that we can't statically evaluate.
 */
function isVariableRef(node) {
  return ts.isIdentifier(node) || ts.isPropertyAccessExpression(node);
}

/**
 * Check if a node is an arrow function or function expression (Resolvable<>).
 */
function isFunctionValue(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

/**
 * Check if an expression contains a ternary (conditional) that we can't trivially evaluate.
 */
function hasTernary(node) {
  if (ts.isConditionalExpression(node)) return true;
  let found = false;
  ts.forEachChild(node, child => {
    if (hasTernary(child)) found = true;
  });
  return found;
}

// ─── Transform Logic ────────────────────────────────────────────────────────

/**
 * Transform a file's source text, returning the new text (or null if unchanged).
 */
function transformFile(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  // Collect all replacements as { start, end, newText }
  const replacements = [];
  const todoComments = []; // { pos, text }

  function visit(node) {
    // JSX opening element or self-closing element
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const propMap = COMPONENT_PROPS[tagName];
      if (propMap) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const propName = attr.name.getText(sourceFile);
          const classification = propMap[propName];
          if (!classification) continue;

          const initializer = attr.initializer;
          if (!initializer) continue;

          // JSX expression container: prop={...}
          if (ts.isJsxExpression(initializer) && initializer.expression) {
            const expr = initializer.expression;
            processExpression(expr, classification, tagName, propName, sourceFile, replacements, todoComments);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (replacements.length === 0 && todoComments.length === 0) return null;

  // Apply replacements in reverse order to preserve positions
  replacements.sort((a, b) => b.start - a.start);
  let result = sourceText;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.newText + result.slice(r.end);
  }

  return result;
}

/**
 * Process a single expression node according to its classification.
 */
function processExpression(expr, classification, tagName, propName, sourceFile, replacements, todoComments) {
  // Handle function values (Resolvable<>) — add TODO comment
  if (isFunctionValue(expr)) {
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(expr.getStart(sourceFile));
    todoComments.push({
      pos: expr.getStart(sourceFile),
      text: `// TODO: migrate ${tagName}.${propName} Resolvable<> to unit string`,
    });
    return;
  }

  // Handle ternary expressions — skip (too complex for mechanical transform)
  if (hasTernary(expr)) {
    return;
  }

  switch (classification) {
    case 'pct':
      transformScalarPct(expr, sourceFile, replacements);
      break;
    case 'u':
      transformScalarU(expr, sourceFile, replacements);
      break;
    case 'rad':
      transformScalarRad(expr, sourceFile, replacements);
      break;
    case 'deg':
      transformScalarDeg(expr, sourceFile, replacements);
      break;
    case 'pct2':
      transformTuple(expr, 2, toPct, sourceFile, replacements);
      break;
    case 'u2':
      transformTuple(expr, 2, toU, sourceFile, replacements);
      break;
    case 'pct3':
      transformTuple(expr, 3, toPct, sourceFile, replacements);
      break;
    case 'rad3':
      transformTuple(expr, 3, toRad, sourceFile, replacements);
      break;
    case 'pct_or_pct2':
      // margin can be a single number or [number, number]
      if (ts.isArrayLiteralExpression(expr)) {
        transformTuple(expr, 2, toPct, sourceFile, replacements);
      } else {
        transformScalarPct(expr, sourceFile, replacements);
      }
      break;
    case 'pct_padding':
      // ScenePadding: 1, 2, 3, or 4 elements, or a single value
      if (ts.isArrayLiteralExpression(expr)) {
        transformTupleVariable(expr, toPct, sourceFile, replacements);
      } else {
        transformScalarPct(expr, sourceFile, replacements);
      }
      break;
  }
}

/** Transform a single numeric expression to a "N%" string. */
function transformScalarPct(expr, sourceFile, replacements) {
  const val = evalNumericExpr(expr, sourceFile);
  if (val === null) return; // Can't evaluate — skip (variable ref, etc.)
  if (val.value === 0) {
    // 0 is valid as bare 0 (SceneLength accepts 0), but the type is `0` not `number`
    // So we need to keep it as 0, not "0%"
    return;
  }
  const s = toPct(val.value);
  const start = expr.getStart(sourceFile);
  const end = expr.getEnd();
  replacements.push({ start, end, newText: `"${s}"` });
}

/** Transform a single numeric expression to a "Nu" string. */
function transformScalarU(expr, sourceFile, replacements) {
  const val = evalNumericExpr(expr, sourceFile);
  if (val === null) return;
  if (val.value === 0) return; // 0 stays as 0
  const s = toU(val.value);
  const start = expr.getStart(sourceFile);
  const end = expr.getEnd();
  replacements.push({ start, end, newText: `"${s}"` });
}

/** Transform a single numeric expression to a "Nrad" string. */
function transformScalarRad(expr, sourceFile, replacements) {
  const val = evalNumericExpr(expr, sourceFile);
  if (val === null) return;
  if (val.value === 0) return; // 0 stays as 0
  const s = toRad(val.value);
  const start = expr.getStart(sourceFile);
  const end = expr.getEnd();
  replacements.push({ start, end, newText: `"${s}"` });
}

/** Transform a single numeric expression to a "Ndeg" string. */
function transformScalarDeg(expr, sourceFile, replacements) {
  const val = evalNumericExpr(expr, sourceFile);
  if (val === null) return;
  if (val.value === 0) return; // 0 stays as 0
  const s = toDeg(val.value);
  const start = expr.getStart(sourceFile);
  const end = expr.getEnd();
  replacements.push({ start, end, newText: `"${s}"` });
}

/**
 * Transform an array literal [a, b] or [a, b, c] where each element is converted
 * using the given converter function.
 */
function transformTuple(expr, expectedLen, converter, sourceFile, replacements) {
  if (!ts.isArrayLiteralExpression(expr)) return;
  const elems = expr.elements;
  if (elems.length !== expectedLen) return;

  // Evaluate all elements first
  const values = [];
  for (const elem of elems) {
    const val = evalNumericExpr(elem, sourceFile);
    if (val === null) return; // Can't evaluate one element — skip entire tuple
    values.push(val.value);
  }

  // Build replacement for each element
  for (let i = 0; i < elems.length; i++) {
    const v = values[i];
    const elem = elems[i];
    const start = elem.getStart(sourceFile);
    const end = elem.getEnd();
    if (v === 0) {
      // Replace with literal 0 (not "0%") — SceneLength accepts 0
      replacements.push({ start, end, newText: '0' });
    } else {
      const s = converter(v);
      replacements.push({ start, end, newText: `"${s}"` });
    }
  }
}

/**
 * Transform an array literal of variable length (ScenePadding: 1-4 elements).
 */
function transformTupleVariable(expr, converter, sourceFile, replacements) {
  if (!ts.isArrayLiteralExpression(expr)) return;
  const elems = expr.elements;

  const values = [];
  for (const elem of elems) {
    const val = evalNumericExpr(elem, sourceFile);
    if (val === null) return;
    values.push(val.value);
  }

  for (let i = 0; i < elems.length; i++) {
    const v = values[i];
    const elem = elems[i];
    const start = elem.getStart(sourceFile);
    const end = elem.getEnd();
    if (v === 0) {
      replacements.push({ start, end, newText: '0' });
    } else {
      const s = converter(v);
      replacements.push({ start, end, newText: `"${s}"` });
    }
  }
}

// ─── Object Literal Patterns ────────────────────────────────────────────────
// Some props reference shared constant objects like:
//   const V = { x: 0.15, y: 0.10, w: 0.7, h: 0.78 } as const;
//   <View id="v" x={V.x} y={V.y} w={V.w} h={V.h}>
// These property accesses (V.x etc.) are variable refs that evalNumericExpr
// returns null for. The codemod won't transform them. Instead, we need to
// transform the object literal definitions themselves.
//
// Strategy: Find `as const` object literals whose property names match
// known % props (x, y, w, h) and transform those too.

const LAYOUT_CONST_PROPS = new Set(['x', 'y', 'w', 'h']);

/**
 * Look for top-level const declarations like:
 *   const V = { x: 0.15, y: 0.10, w: 0.7, h: 0.78 } as const;
 *   const CHART_LAYOUT = { x: 0.19, y: 0.16, w: 0.62, h: 0.52 } as const;
 * and transform x/y/w/h values to percentage strings.
 *
 * This function modifies `replacements` in place.
 */
function transformLayoutConstants(sourceFile, sourceText, replacements) {
  function visit(node) {
    // Look for: const NAME = { ... } as const;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!decl.initializer) continue;

        // Check for `as const` assertion
        let objExpr = null;
        if (ts.isAsExpression(decl.initializer) &&
            ts.isObjectLiteralExpression(decl.initializer.expression)) {
          objExpr = decl.initializer.expression;
        } else if (ts.isObjectLiteralExpression(decl.initializer)) {
          objExpr = decl.initializer;
        }

        if (!objExpr) continue;

        // Check if this object has x, y, w, h properties with numeric values
        const propNames = new Set();
        for (const prop of objExpr.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            propNames.add(prop.name.text);
          }
        }

        // Must have at least x,y or w,h to be a layout constant
        const hasXY = propNames.has('x') && propNames.has('y');
        const hasWH = propNames.has('w') && propNames.has('h');
        if (!hasXY && !hasWH) continue;

        // Only transform if ALL of {x,y,w,h} are numeric
        for (const prop of objExpr.properties) {
          if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
          const name = prop.name.text;
          if (!LAYOUT_CONST_PROPS.has(name)) continue;

          const val = evalNumericExpr(prop.initializer, sourceFile);
          if (val === null) continue;
          if (val.value === 0) continue; // 0 stays as 0

          const s = toPct(val.value);
          const start = prop.initializer.getStart(sourceFile);
          const end = prop.initializer.getEnd();
          replacements.push({ start, end, newText: `"${s}"` });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// ─── Enhanced Transform ─────────────────────────────────────────────────────

function transformFileEnhanced(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const replacements = [];
  const todoComments = [];

  // Pass 1: Transform JSX attributes
  function visitJsx(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const propMap = COMPONENT_PROPS[tagName];
      if (propMap) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const propName = attr.name.getText(sourceFile);
          const classification = propMap[propName];
          if (!classification) continue;

          const initializer = attr.initializer;
          if (!initializer) continue;

          if (ts.isJsxExpression(initializer) && initializer.expression) {
            const expr = initializer.expression;
            processExpression(expr, classification, tagName, propName, sourceFile, replacements, todoComments);
          }
        }
      }
    }
    ts.forEachChild(node, visitJsx);
  }

  visitJsx(sourceFile);

  // Pass 2: Transform layout constant objects
  transformLayoutConstants(sourceFile, sourceText, replacements);

  if (replacements.length === 0 && todoComments.length === 0) return null;

  // Deduplicate replacements (same start position)
  const seen = new Set();
  const uniqueReplacements = replacements.filter(r => {
    const key = `${r.start}:${r.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Apply replacements in reverse order to preserve positions
  uniqueReplacements.sort((a, b) => b.start - a.start);
  let result = sourceText;
  for (const r of uniqueReplacements) {
    result = result.slice(0, r.start) + r.newText + result.slice(r.end);
  }

  return result;
}

// ─── File Discovery ─────────────────────────────────────────────────────────

function findTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => !a.startsWith('--'));

let targetFiles;
if (files.length > 0) {
  targetFiles = files.map(f => path.resolve(f));
} else {
  const root = path.resolve(import.meta.dirname, '..');
  targetFiles = [
    ...findTsxFiles(path.join(root, 'apps')),
    ...findTsxFiles(path.join(root, 'docs')),
  ];
}

let changed = 0;
let skipped = 0;

for (const filePath of targetFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const result = transformFileEnhanced(filePath, sourceText);

  if (result === null) {
    skipped++;
    continue;
  }

  const relPath = path.relative(process.cwd(), filePath);
  if (dryRun) {
    console.log(`[dry-run] Would transform: ${relPath}`);
    changed++;
  } else {
    fs.writeFileSync(filePath, result, 'utf-8');
    console.log(`Transformed: ${relPath}`);
    changed++;
  }
}

console.log(`\nDone. ${changed} files ${dryRun ? 'would be ' : ''}transformed, ${skipped} files unchanged.`);
