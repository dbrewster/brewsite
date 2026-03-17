/**
 * Floor element Three.js renderer.
 * Excluded from test coverage - Three.js rendering logic.
 */

import type { FloorSurfaceMirror, FloorSurfacePhysical, SceneFloor } from './types';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { clamp01, parseHexColor } from '../../math';
import type { MaterialManifest } from '../../widget/materialTypes';
import type { MaterialLoader } from '../../widget/MaterialLoader';
import { createPresetMaterial, applyMaterialApplication } from '../_shared/materialFactory';
import type CustomShaderMaterial from 'three-custom-shader-material/vanilla';

export type FloorThreeRefs = {
  scene: THREE.Scene;
  /** Material loader for preset textures. */
  materialLoader?: MaterialLoader;
  /** Material manifest for preset lookup. */
  materialManifest?: MaterialManifest | null;
};

type FloorInstance = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  isMirror: boolean;
  shadowCatcher?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  textureUrl?: string;
  textureRepeat?: [number, number];
  textureOffset?: [number, number];
  textureRotation?: number;
  normalMapUrl?: string;
  roughnessMapUrl?: string;
  metalnessMapUrl?: string;
  aoMapUrl?: string;
  displacementMapUrl?: string;
  alphaMapUrl?: string;
  emissiveMapUrl?: string;
  isUsingGridPattern?: boolean;
  gridLines?: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  gridLinesKey?: string;
  /** DEBUG: bright line marking world Z=0 on the grid floor. */
  debugZeroLine?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** CSM preset material instance (null = using fallback). */
  presetMaterial?: CustomShaderMaterial | null;
  /** Last surface material name for change detection. */
  lastSurfaceMaterial?: string | null;
  /** Set of preset names already warned about (missing from manifest). */
  warnedPresets?: Set<string>;
};

const FLOOR_KEY = '__brewsite_floor';
const FLOOR_PART_KEY = '__brewsite_floor_part';
const ENV_KEY = '__brewsite_environment';
const FLOOR_SIZE = 400;
const FLOOR_BASE_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const FLOOR_DEPTH_UNBOUNDED_MIN_Z = -1_000_000;
const FLOOR_DEFAULT_FADE_FRACTION = 0.18;
const FLOOR_DEFAULT_FADE_MAX_DISTANCE = 40;

type FloorDepthEdgeConfig = {
  minZ: number;
  fadeDistance: number;
};

type FloorDepthShaderUniformRefs = {
  minZ: { value: number };
  fadeDistance: { value: number };
};

type FloorMutableShader = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

type FloorDepthMaterialUserData = {
  __brewFloorDepthPatched?: boolean;
  __brewFloorDepthSettings?: FloorDepthEdgeConfig;
  __brewFloorDepthUniforms?: FloorDepthShaderUniformRefs;
};

const resolveFloorRotation = (state: SceneFloor): [number, number, number] => {
  if (state.rotationRelative) {
    return [
      FLOOR_BASE_ROTATION[0] + state.rotationRelative[0],
      FLOOR_BASE_ROTATION[1] + state.rotationRelative[1],
      FLOOR_BASE_ROTATION[2] + state.rotationRelative[2],
    ];
  }
  if (state.rotation) return state.rotation;
  return FLOOR_BASE_ROTATION;
};

const isFloorPart = (object: THREE.Object3D): boolean => {
  const userData = object.userData as { [FLOOR_PART_KEY]?: boolean };
  return userData[FLOOR_PART_KEY] === true;
};

const computeSceneBaseY = (scene: THREE.Scene): number => {
  const sceneBounds = new THREE.Box3();
  const objectBounds = new THREE.Box3();
  let found = false;

  scene.updateMatrixWorld(true);
  for (const child of scene.children) {
    if (!child.visible || isFloorPart(child)) continue;
    objectBounds.makeEmpty();
    objectBounds.expandByObject(child);
    if (objectBounds.isEmpty()) continue;
    sceneBounds.union(objectBounds);
    found = true;
  }

  return found ? sceneBounds.min.y : 0;
};

const resolveFloorPosition = (state: SceneFloor, scene: THREE.Scene): [number, number, number] => {
  const x = state.position?.[0] ?? 0;
  const y = state.position?.[1] ?? 0;
  const z = state.position?.[2] ?? 0;
  if (state.placement === 'sceneBase') {
    return [x, computeSceneBaseY(scene) + y, z];
  }
  return [x, y, z];
};

const resolveFloorDepthEdgeConfig = (state: SceneFloor, originZ: number): FloorDepthEdgeConfig => {
  const extentRaw = state.negativeZExtent;
  if (!(typeof extentRaw === 'number' && Number.isFinite(extentRaw) && extentRaw > 0)) {
    return { minZ: FLOOR_DEPTH_UNBOUNDED_MIN_Z, fadeDistance: 0 };
  }

  const minZ = originZ - extentRaw;
  if (state.negativeZEdge !== 'fade') {
    return { minZ, fadeDistance: 0 };
  }

  const fadeDistanceRaw = state.negativeZFadeDistance;
  const fallbackFadeDistance = Math.min(
    FLOOR_DEFAULT_FADE_MAX_DISTANCE,
    Math.max(0.25, extentRaw * FLOOR_DEFAULT_FADE_FRACTION),
  );
  const fadeDistance =
    typeof fadeDistanceRaw === 'number' && Number.isFinite(fadeDistanceRaw) && fadeDistanceRaw > 0
      ? Math.min(extentRaw, fadeDistanceRaw)
      : Math.min(extentRaw, fallbackFadeDistance);

  return { minZ, fadeDistance };
};

const ensureDepthShaderUniforms = (
  shaderUniforms: Record<string, { value: unknown }>,
  settings: FloorDepthEdgeConfig,
): FloorDepthShaderUniformRefs => {
  if (!shaderUniforms['brewFloorMinZ']) {
    shaderUniforms['brewFloorMinZ'] = { value: settings.minZ };
  }
  if (!shaderUniforms['brewFloorFadeDistance']) {
    shaderUniforms['brewFloorFadeDistance'] = { value: settings.fadeDistance };
  }
  return {
    minZ: shaderUniforms['brewFloorMinZ']!,
    fadeDistance: shaderUniforms['brewFloorFadeDistance']!,
  } as FloorDepthShaderUniformRefs;
};

const patchStandardDepthShader = (
  shader: FloorMutableShader,
  settings: FloorDepthEdgeConfig,
): FloorDepthShaderUniformRefs | undefined => {
  const uniforms = ensureDepthShaderUniforms(
    shader.uniforms as Record<string, { value: unknown }>,
    settings,
  );

  if (!shader.vertexShader.includes('varying vec3 brewFloorWorldPosition;')) {
    shader.vertexShader = `varying vec3 brewFloorWorldPosition;\n${shader.vertexShader}`;
  }
  if (
    shader.vertexShader.includes('#include <begin_vertex>') &&
    !shader.vertexShader.includes('brewFloorWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;')
  ) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tbrewFloorWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
    );
  }

  if (!shader.fragmentShader.includes('varying vec3 brewFloorWorldPosition;')) {
    shader.fragmentShader = [
      'varying vec3 brewFloorWorldPosition;',
      'uniform float brewFloorMinZ;',
      'uniform float brewFloorFadeDistance;',
      shader.fragmentShader,
    ].join('\n');
  }
  if (!shader.fragmentShader.includes('float brewFloorDepthFactor()')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      [
        'float brewFloorDepthFactor() {',
        `  if (brewFloorMinZ <= ${FLOOR_DEPTH_UNBOUNDED_MIN_Z + 1}.0) return 1.0;`,
        '  if (brewFloorFadeDistance <= 0.0001) {',
        '    return brewFloorWorldPosition.z >= brewFloorMinZ ? 1.0 : 0.0;',
        '  }',
        '  return clamp((brewFloorWorldPosition.z - brewFloorMinZ) / brewFloorFadeDistance, 0.0, 1.0);',
        '}',
        '',
        'void main() {',
      ].join('\n'),
    );
  }

  if (
    shader.fragmentShader.includes('#include <opaque_fragment>') &&
    !shader.fragmentShader.includes('brewFloorDepthFactorValue')
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      [
        'float brewFloorDepthFactorValue = brewFloorDepthFactor();',
        'if (brewFloorDepthFactorValue <= 0.0) discard;',
        'diffuseColor.a *= brewFloorDepthFactorValue;',
        '#include <opaque_fragment>',
      ].join('\n'),
    );
    return uniforms;
  }

  if (
    shader.fragmentShader.includes('gl_FragColor = vec4( diffuseColor.rgb, diffuseColor.a );') &&
    !shader.fragmentShader.includes('brewFloorDepthFactorLine')
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, diffuseColor.a );',
      [
        'float brewFloorDepthFactorLine = brewFloorDepthFactor();',
        'if (brewFloorDepthFactorLine <= 0.0) discard;',
        'gl_FragColor = vec4( diffuseColor.rgb, diffuseColor.a * brewFloorDepthFactorLine );',
      ].join('\n'),
    );
    return uniforms;
  }

  const shadowRegex = /gl_FragColor\s*=\s*vec4\(\s*color,\s*opacity\s*\*\s*\(\s*1\.0\s*-\s*getShadowMask\(\)\s*\)\s*\)\s*;/;
  if (shadowRegex.test(shader.fragmentShader) && !shader.fragmentShader.includes('brewFloorDepthFactorShadow')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      shadowRegex,
      [
        'float brewFloorDepthFactorShadow = brewFloorDepthFactor();',
        'if (brewFloorDepthFactorShadow <= 0.0) discard;',
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * brewFloorDepthFactorShadow );',
      ].join('\n'),
    );
    return uniforms;
  }

  return uniforms;
};

const ensureStandardDepthEdgeShaderPatch = (material: THREE.Material): void => {
  const userData = material.userData as FloorDepthMaterialUserData;
  if (userData.__brewFloorDepthPatched) return;

  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey?.bind(material);
  userData.__brewFloorDepthPatched = true;
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    const settings = userData.__brewFloorDepthSettings ?? {
      minZ: FLOOR_DEPTH_UNBOUNDED_MIN_Z,
      fadeDistance: 0,
    };
    const uniforms = patchStandardDepthShader(shader, settings);
    if (uniforms) {
      userData.__brewFloorDepthUniforms = uniforms;
    }
  };
  material.customProgramCacheKey = () => {
    const base = previousProgramCacheKey ? previousProgramCacheKey() : '';
    return `${base}|brewFloorDepthEdgeV1`;
  };
  material.needsUpdate = true;
};

const ensureMirrorOpacityShader = (material: THREE.Material): void => {
  const shader = material as THREE.ShaderMaterial;
  if (!shader.uniforms) return;

  const userData = material.userData as FloorDepthMaterialUserData;
  const uniforms = ensureDepthShaderUniforms(
    shader.uniforms as Record<string, { value: unknown }>,
    { minZ: FLOOR_DEPTH_UNBOUNDED_MIN_Z, fadeDistance: 0 },
  );
  userData.__brewFloorDepthUniforms = uniforms;

  let changed = false;
  if (!shader.uniforms['opacity']) {
    shader.uniforms['opacity'] = { value: 1 };
    changed = true;
  }

  if (shader.fragmentShader && !shader.fragmentShader.includes('uniform float opacity')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'uniform sampler2D tDiffuse;',
      'uniform sampler2D tDiffuse;\n\t\tuniform float opacity;',
    );
    changed = true;
  }

  if (shader.vertexShader && !shader.vertexShader.includes('varying vec3 brewFloorWorldPosition;')) {
    shader.vertexShader = `varying vec3 brewFloorWorldPosition;\n${shader.vertexShader}`;
    changed = true;
  }
  if (
    shader.vertexShader &&
    !shader.vertexShader.includes('brewFloorWorldPosition = ( modelMatrix * vec4( position, 1.0 ) ).xyz;')
  ) {
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'void main() {\n\t\t\tbrewFloorWorldPosition = ( modelMatrix * vec4( position, 1.0 ) ).xyz;',
    );
    changed = true;
  }

  if (shader.fragmentShader && !shader.fragmentShader.includes('varying vec3 brewFloorWorldPosition;')) {
    shader.fragmentShader = [
      'varying vec3 brewFloorWorldPosition;',
      'uniform float brewFloorMinZ;',
      'uniform float brewFloorFadeDistance;',
      shader.fragmentShader,
    ].join('\n');
    changed = true;
  }

  if (shader.fragmentShader && !shader.fragmentShader.includes('float brewFloorDepthFactor()')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      [
        'float brewFloorDepthFactor() {',
        `  if (brewFloorMinZ <= ${FLOOR_DEPTH_UNBOUNDED_MIN_Z + 1}.0) return 1.0;`,
        '  if (brewFloorFadeDistance <= 0.0001) {',
        '    return brewFloorWorldPosition.z >= brewFloorMinZ ? 1.0 : 0.0;',
        '  }',
        '  return clamp((brewFloorWorldPosition.z - brewFloorMinZ) / brewFloorFadeDistance, 0.0, 1.0);',
        '}',
        '',
        'void main() {',
      ].join('\n'),
    );
    changed = true;
  }

  if (
    shader.fragmentShader &&
    shader.fragmentShader.includes('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );')
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      'vec3 blended = blendOverlay( base.rgb, color );\n\t\t\tgl_FragColor = vec4( blended * opacity, opacity );',
    );
    changed = true;
  }
  if (shader.fragmentShader && !shader.fragmentShader.includes('brewFloorDepthFactorMirror')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( blended * opacity, opacity );',
      [
        'float brewFloorDepthFactorMirror = brewFloorDepthFactor();',
        'if (brewFloorDepthFactorMirror <= 0.0) discard;',
        'gl_FragColor = vec4( blended * opacity, opacity * brewFloorDepthFactorMirror );',
      ].join('\n\t\t\t'),
    );
    changed = true;
  }

  if (changed) {
    shader.needsUpdate = true;
  }
};

const setFloorDepthEdgeMaterialState = (
  material: THREE.Material | undefined,
  settings: FloorDepthEdgeConfig,
): void => {
  if (!material) return;
  if (material instanceof THREE.ShaderMaterial && material.fragmentShader.includes('blendOverlay(')) {
    ensureMirrorOpacityShader(material);
  } else {
    ensureStandardDepthEdgeShaderPatch(material);
  }

  const userData = material.userData as FloorDepthMaterialUserData;
  userData.__brewFloorDepthSettings = settings;
  if (userData.__brewFloorDepthUniforms) {
    userData.__brewFloorDepthUniforms.minZ.value = settings.minZ;
    userData.__brewFloorDepthUniforms.fadeDistance.value = settings.fadeDistance;
  }
};

const resetMaterialMapKeys = (instance: FloorInstance): void => {
  instance.textureUrl = undefined;
  instance.textureRepeat = undefined;
  instance.textureOffset = undefined;
  instance.textureRotation = undefined;
  instance.normalMapUrl = undefined;
  instance.roughnessMapUrl = undefined;
  instance.metalnessMapUrl = undefined;
  instance.aoMapUrl = undefined;
  instance.displacementMapUrl = undefined;
  instance.alphaMapUrl = undefined;
  instance.emissiveMapUrl = undefined;
};

const clearPhysicalMaps = (material: THREE.MeshPhysicalMaterial): void => {
  if (material.map) material.map.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.roughnessMap) material.roughnessMap.dispose();
  if (material.metalnessMap) material.metalnessMap.dispose();
  if (material.aoMap) material.aoMap.dispose();
  if (material.displacementMap) material.displacementMap.dispose();
  if (material.alphaMap) material.alphaMap.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();
  material.map = null;
  material.normalMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.aoMap = null;
  material.displacementMap = null;
  material.alphaMap = null;
  material.emissiveMap = null;
  material.needsUpdate = true;
};

const disposeGridLines = (instance: FloorInstance): void => {
  if (instance.debugZeroLine) {
    instance.mesh.remove(instance.debugZeroLine);
    instance.debugZeroLine.geometry.dispose();
    instance.debugZeroLine.material.dispose();
    instance.debugZeroLine = undefined;
  }
  if (!instance.gridLines) return;
  instance.mesh.remove(instance.gridLines);
  instance.gridLines.geometry.dispose();
  instance.gridLines.material.dispose();
  instance.gridLines = undefined;
  instance.gridLinesKey = undefined;
};

/**
 * DEBUG: draws a bright red line across the floor at world Z=0.
 *
 * The floor mesh has rotation.x = -PI/2, so local (x, y, 0) → world (x+px, py, -y+pz).
 * World Z=0 therefore maps to local Y = mesh.position.z.
 * The line runs the full floor width at that local Y, sitting 0.002 above the grid at 0.001.
 */
const ensureDebugZeroLine = (instance: FloorInstance): void => {
  const half = FLOOR_SIZE / 2;
  // World Z=0 is at local Y = mesh.position.z (see rotation derivation above).
  const localY = instance.mesh.position.z;
  const z = 0.002; // just above the grid lines at 0.001

  if (!instance.debugZeroLine) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half, localY, z),
      new THREE.Vector3(half, localY, z),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#ff2020'),
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geo, mat);
    line.name = 'FloorDebugZeroLine';
    (line.userData as { [key: string]: unknown })[FLOOR_PART_KEY] = true;
    instance.mesh.add(line);
    instance.debugZeroLine = line as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  } else {
    // Recompute if the mesh has moved (e.g. floor placement changed).
    instance.debugZeroLine.geometry.setFromPoints([
      new THREE.Vector3(-half, localY, z),
      new THREE.Vector3(half, localY, z),
    ]);
  }
};

const buildGridLines = (
  size: number,
  divisions: number,
  majorEvery: number,
  minorColor: THREE.Color,
  majorColor: THREE.Color,
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> => {
  const lineCount = (divisions + 1) * 2;
  const positions = new Float32Array(lineCount * 2 * 3);
  const colors = new Float32Array(lineCount * 2 * 3);
  const half = size / 2;
  const step = size / divisions;
  const centerIndex = divisions / 2;

  let cursor = 0;
  const writeLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: THREE.Color,
  ): void => {
    positions[cursor + 0] = x1;
    positions[cursor + 1] = y1;
    positions[cursor + 2] = 0;
    positions[cursor + 3] = x2;
    positions[cursor + 4] = y2;
    positions[cursor + 5] = 0;

    colors[cursor + 0] = color.r;
    colors[cursor + 1] = color.g;
    colors[cursor + 2] = color.b;
    colors[cursor + 3] = color.r;
    colors[cursor + 4] = color.g;
    colors[cursor + 5] = color.b;
    cursor += 6;
  };

  for (let i = 0; i <= divisions; i++) {
    const p = -half + i * step;
    const isMajor = Math.abs(i - centerIndex) % majorEvery === 0;
    const color = isMajor ? majorColor : minorColor;
    writeLine(p, -half, p, half, color);
    writeLine(-half, p, half, p, color);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  });

  return new THREE.LineSegments(geometry, material);
};

const ensureGridLines = (
  instance: FloorInstance,
  state: FloorSurfacePhysical,
  floorScale: number,
): void => {
  const gridCellSizeRaw = state.gridCellSize ?? 2;
  const gridCellSize =
    Number.isFinite(gridCellSizeRaw) && gridCellSizeRaw > 0
      ? gridCellSizeRaw
      : 2;
  const majorEveryRaw = state.gridMajorEvery ?? 5;
  const majorEvery =
    Number.isFinite(majorEveryRaw) && majorEveryRaw >= 1
      ? Math.max(1, Math.min(32, Math.round(majorEveryRaw)))
      : 5;

  const effectiveScale =
    Number.isFinite(floorScale) && floorScale > 0
      ? floorScale
      : 1;
  const estimatedDivisions = Math.round((FLOOR_SIZE * effectiveScale) / gridCellSize);
  const divisions = Math.max(2, Math.min(800, estimatedDivisions));

  const minorParsed = parseHexColor(state.gridColor ?? '#3b4a5e');
  const majorParsed = parseHexColor(state.gridMajorColor ?? '#6a7f98');
  const minorColor = new THREE.Color(minorParsed.rgb);
  const majorColor = new THREE.Color(majorParsed.rgb);
  const lineOpacityRaw = state.gridLineOpacity ?? 0.95;
  const baseLineOpacity =
    Number.isFinite(lineOpacityRaw)
      ? clamp01(lineOpacityRaw)
      : 0.95;
  const lineOpacity = baseLineOpacity * Math.min(minorParsed.alpha, majorParsed.alpha);
  const key = `${divisions}|${majorEvery}|${minorColor.getHexString()}|${majorColor.getHexString()}|${lineOpacity.toFixed(3)}`;

  if (instance.gridLinesKey === key && instance.gridLines) {
    instance.gridLines.visible = true;
    instance.gridLines.material.opacity = lineOpacity;
    instance.gridLines.material.needsUpdate = true;
    return;
  }

  disposeGridLines(instance);
  const lines = buildGridLines(FLOOR_SIZE, divisions, majorEvery, minorColor, majorColor);
  lines.position.set(0, 0, 0.001);
  lines.material.opacity = lineOpacity;
  lines.name = 'FloorGridLines';
  (lines.userData as { [FLOOR_PART_KEY]?: boolean })[FLOOR_PART_KEY] = true;
  instance.mesh.add(lines);
  instance.gridLines = lines;
  instance.gridLinesKey = key;
};

const createShadowCatcher = (
  geometry: THREE.PlaneGeometry,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> => {
  const material = new THREE.ShadowMaterial({ opacity: 0.3 });
  material.transparent = true;
  material.depthWrite = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  const mesh = new THREE.Mesh(geometry.clone(), material);
  mesh.rotation.x = FLOOR_BASE_ROTATION[0];
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'FloorShadowCatcher';
  (mesh.userData as { [FLOOR_PART_KEY]?: boolean })[FLOOR_PART_KEY] = true;
  return mesh;
};

const ensureShadowCatcher = (instance: FloorInstance, scene: THREE.Scene): void => {
  if (instance.shadowCatcher) return;
  const catcher = createShadowCatcher(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE));
  instance.shadowCatcher = catcher;
  scene.add(catcher);
};

const disposeShadowCatcher = (instance: FloorInstance, scene: THREE.Scene): void => {
  if (!instance.shadowCatcher) return;
  scene.remove(instance.shadowCatcher);
  instance.shadowCatcher.geometry.dispose();
  instance.shadowCatcher.material.dispose();
  instance.shadowCatcher = undefined;
};

const getOrCreateFloor = (
  scene: THREE.Scene,
  surface: FloorSurfacePhysical | FloorSurfaceMirror | undefined,
): FloorInstance => {
  const existing = scene.userData[FLOOR_KEY] as FloorInstance | undefined;
  const wantsMirror = surface?.type === 'mirror';
  const mirrorResolution = wantsMirror ? surface.mirrorResolution ?? 1024 : undefined;
  const mirrorClipBias = wantsMirror ? surface.mirrorClipBias ?? 0.003 : undefined;
  if (
    existing?.mesh &&
    existing.isMirror === wantsMirror &&
    existing.mirrorResolution === mirrorResolution &&
    existing.mirrorClipBias === mirrorClipBias
  ) {
    return existing;
  }

  if (existing?.mesh) {
    disposeFloor(scene);
  }

  const geometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  let shadowCatcher: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial> | undefined;

  if (wantsMirror) {
    const mirrorColorParsed = parseHexColor(surface.mirrorColor ?? '#111111');
    mesh = new Reflector(geometry, {
      color: mirrorColorParsed.rgb,
      textureWidth: mirrorResolution,
      textureHeight: mirrorResolution,
      clipBias: mirrorClipBias,
    }) as unknown as THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
    const mirrorOpacity = (typeof surface.mirrorOpacity === 'number' ? surface.mirrorOpacity : 1) * mirrorColorParsed.alpha;
    ensureMirrorOpacityShader(mesh.material);
    mesh.material.transparent = mirrorOpacity < 1;
    mesh.material.depthWrite = mirrorOpacity >= 1;
    mesh.material.opacity = mirrorOpacity;
    shadowCatcher = createShadowCatcher(geometry);
    scene.add(shadowCatcher);

    const originalOnBeforeRender = mesh.onBeforeRender?.bind(mesh);
    mesh.onBeforeRender = (renderer, sceneObj, camera, geom, material, group) => {
      const env = (sceneObj as THREE.Scene).userData[ENV_KEY] as { raw?: THREE.Texture } | undefined;
      const userData = mesh.userData as {
        __brewsite_mirror?: {
          useEnvBackground?: boolean;
          prevBackground?: THREE.Texture | null;
          prevBackgroundIntensity?: number | null;
          envIntensity?: number | null;
        };
      };
      const mirror = userData.__brewsite_mirror;
      if (mirror?.useEnvBackground && env?.raw) {
        mirror.prevBackground = (sceneObj as THREE.Scene).background as THREE.Texture | null;
        (sceneObj as THREE.Scene).background = env.raw;
        if (typeof mirror.envIntensity === 'number') {
          const sceneAny = sceneObj as unknown as { backgroundIntensity?: number };
          mirror.prevBackgroundIntensity =
            typeof sceneAny.backgroundIntensity === 'number' ? sceneAny.backgroundIntensity : null;
          sceneAny.backgroundIntensity = mirror.envIntensity;
        }
      }
      if (originalOnBeforeRender) {
        originalOnBeforeRender(renderer, sceneObj, camera, geom, material, group);
      }
      if (mirror?.useEnvBackground) {
        (sceneObj as THREE.Scene).background = mirror.prevBackground ?? null;
        if (typeof mirror.prevBackgroundIntensity === 'number') {
          const sceneAny = sceneObj as unknown as { backgroundIntensity?: number };
          sceneAny.backgroundIntensity = mirror.prevBackgroundIntensity;
        }
        mirror.prevBackground = undefined;
        mirror.prevBackgroundIntensity = undefined;
      }
    };
  } else {
    const material = new THREE.MeshPhysicalMaterial({
      color: '#151a24',
      roughness: 0.9,
      metalness: 0.1,
    });
    mesh = new THREE.Mesh(geometry, material);
  }

  mesh.rotation.x = FLOOR_BASE_ROTATION[0];
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'Floor';
  (mesh.userData as { [FLOOR_PART_KEY]?: boolean })[FLOOR_PART_KEY] = true;
  scene.add(mesh);

  const instance: FloorInstance = {
    mesh,
    shadowCatcher,
    isMirror: wantsMirror,
    mirrorResolution,
    mirrorClipBias,
  };
  scene.userData[FLOOR_KEY] = instance;
  return instance;
};

const applyTextureParams = (texture: THREE.Texture, state: FloorSurfacePhysical): void => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = state.textureRepeat ?? [4, 4];
  const offset = state.textureOffset ?? [0, 0];
  const rotation = state.textureRotation ?? 0;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.offset.set(offset[0], offset[1]);
  texture.rotation = rotation;
  texture.needsUpdate = true;
};

const applyMapUrl = (
  loader: THREE.TextureLoader,
  instance: FloorInstance,
  state: FloorSurfacePhysical,
  url: string | undefined,
  key: keyof FloorInstance,
  apply: (texture: THREE.Texture) => void,
  clear: () => void,
): void => {
  const prevUrl = instance[key] as string | undefined;
  if (url && url !== prevUrl) {
    loader.load(url, (texture) => {
      applyTextureParams(texture, state);
      apply(texture);
    });
    instance[key] = url as never;
  } else if (!url && prevUrl) {
    clear();
    instance[key] = undefined as never;
  }
};

const applyTransform = (
  instance: FloorInstance,
  state: SceneFloor,
  scene: THREE.Scene,
): { scale: number } => {
  const position = resolveFloorPosition(state, scene);
  const rotation = resolveFloorRotation(state);
  const scale = typeof state.scale === 'number' && Number.isFinite(state.scale) ? state.scale : 1;

  instance.mesh.position.set(position[0], position[1], position[2]);
  instance.mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  instance.mesh.scale.set(scale, scale, scale);

  if (instance.shadowCatcher) {
    instance.shadowCatcher.position.set(position[0], position[1], position[2]);
    instance.shadowCatcher.rotation.set(rotation[0], rotation[1], rotation[2]);
    instance.shadowCatcher.scale.set(scale, scale, scale);
  }

  return { scale };
};

const disposeMaterial = (material: THREE.Material): void => {
  const mat = material as unknown as Record<string, unknown>;
  for (const value of Object.values(mat)) {
    if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
};

export const disposeFloor = (scene: THREE.Scene): void => {
  const instance = scene.userData[FLOOR_KEY] as FloorInstance | undefined;
  if (!instance?.mesh) return;

  disposeGridLines(instance);
  scene.remove(instance.mesh);
  const reflector = instance.mesh as unknown as { dispose?: () => void };
  if (typeof reflector.dispose === 'function') {
    reflector.dispose();
  }
  instance.mesh.geometry.dispose();
  disposeMaterial(instance.mesh.material);

  disposeShadowCatcher(instance, scene);

  delete scene.userData[FLOOR_KEY];
};

const disposeDebugZeroLine = (instance: FloorInstance): void => {
  if (!instance.debugZeroLine) return;
  instance.mesh.remove(instance.debugZeroLine);
  instance.debugZeroLine.geometry.dispose();
  instance.debugZeroLine.material.dispose();
  instance.debugZeroLine = undefined;
};

const disposePresetMaterial = (instance: FloorInstance): void => {
  if (instance.presetMaterial) {
    instance.presetMaterial.dispose();
    instance.presetMaterial = null;
  }
};

/**
 * Attempts to apply a preset material to the floor.
 * Returns true if the preset material was successfully applied (or is loading).
 * Returns false if the preset is not in manifest (fallback to base color).
 */
const applyFloorPresetMaterial = (
  floor: FloorInstance,
  surface: FloorSurfacePhysical,
  refs: FloorThreeRefs,
): boolean => {
  const presetName = surface.surfaceMaterial;
  if (!presetName) return false;

  const manifest = refs.materialManifest;
  const loader = refs.materialLoader;

  // Case: no manifest or no loader — can't load presets.
  if (!manifest || !loader) return false;

  const preset = manifest.presets[presetName];
  if (!preset) {
    // Case: preset name not in manifest — warn once, fall back to base color.
    if (!floor.warnedPresets) floor.warnedPresets = new Set();
    if (!floor.warnedPresets.has(presetName)) {
      console.warn(
        `[FloorWidget] Material preset "${presetName}" not found in manifest. ` +
        `Falling back to base color.`,
      );
      floor.warnedPresets.add(presetName);
    }
    if (floor.presetMaterial) {
      disposePresetMaterial(floor);
      floor.lastSurfaceMaterial = null;
    }
    return false;
  }

  // Don't retry presets that have permanently failed to load.
  if (loader.isPresetFailed(preset, manifest.basePath)) return false;

  // Check if textures are already loaded (sync cache hit).
  const loaded = loader.getLoadedPresetByKey(preset, manifest.basePath);

  if (!loaded) {
    // Case: preset in manifest but still loading — kick off load, use existing material.
    // loadPreset returns null on failure; MaterialLoader caches the failure internally.
    void loader.loadPreset(preset, manifest.basePath);
    return false;
  }

  // Case: preset loaded — create or update CSM material.
  const presetChanged = floor.lastSurfaceMaterial !== presetName;
  if (presetChanged || !floor.presetMaterial) {
    disposePresetMaterial(floor);
    const baseColor = surface.color ?? '#151a24';
    const baseOpacity = typeof surface.opacity === 'number' ? surface.opacity : 1;
    const csmMaterial = createPresetMaterial({
      textures: loaded.textures,
      defaults: loaded.defaults,
      projection: 'uv',
      application: surface.materialApplication,
      baseColor,
      baseOpacity,
      metalness: surface.metalness,
      roughness: surface.roughness,
    });
    csmMaterial.transparent = baseOpacity < 1;
    csmMaterial.depthWrite = baseOpacity >= 1;
    floor.mesh.material = csmMaterial;
    floor.presetMaterial = csmMaterial;
    floor.lastSurfaceMaterial = presetName;
  } else {
    // Same preset, update application controls (uniform-only, no recompile).
    if (surface.materialApplication) {
      applyMaterialApplication(floor.presetMaterial, surface.materialApplication, surface.color);
    }
    // Update base opacity.
    const baseOpacity = typeof surface.opacity === 'number' ? surface.opacity : 1;
    floor.presetMaterial.transparent = baseOpacity < 1;
    floor.presetMaterial.depthWrite = baseOpacity >= 1;
    floor.presetMaterial.opacity = baseOpacity;
  }
  return true;
};

export function applyFloor(state: SceneFloor, refs: FloorThreeRefs): void {
  const surface = state.surface;
  if (!state.enabled || !surface) {
    const existing = refs.scene.userData[FLOOR_KEY] as FloorInstance | undefined;
    if (existing?.mesh) {
      existing.mesh.visible = false;
      if (existing.shadowCatcher) existing.shadowCatcher.visible = false;
      if (existing.gridLines) existing.gridLines.visible = false;
    }
    return;
  }

  const floor = getOrCreateFloor(refs.scene, surface);
  floor.mesh.visible = true;
  if (floor.shadowCatcher) floor.shadowCatcher.visible = true;
  const { scale } = applyTransform(floor, state, refs.scene);
  const depthEdge = resolveFloorDepthEdgeConfig(state, floor.mesh.position.z);
  setFloorDepthEdgeMaterialState(floor.mesh.material, depthEdge);
  if (floor.shadowCatcher) {
    setFloorDepthEdgeMaterialState(floor.shadowCatcher.material, depthEdge);
  }

  if (floor.isMirror) {
    if (surface.type !== 'mirror') return;
    floor.mirrorUseEnvironmentBackground = surface.mirrorUseEnvironmentBackground === true;
    const userData = floor.mesh.userData as {
      __brewsite_mirror?: { useEnvBackground?: boolean; envIntensity?: number | null };
    };
    userData.__brewsite_mirror = userData.__brewsite_mirror ?? {};
    userData.__brewsite_mirror.useEnvBackground = floor.mirrorUseEnvironmentBackground;
    userData.__brewsite_mirror.envIntensity =
      typeof surface.mirrorEnvironmentIntensity === 'number' ? surface.mirrorEnvironmentIntensity : null;

    const applyMirrorParsed = parseHexColor(surface.mirrorColor ?? '#111111');
    const mirrorOpacity = (typeof surface.mirrorOpacity === 'number' ? surface.mirrorOpacity : 1) * applyMirrorParsed.alpha;
    floor.mesh.material.transparent = mirrorOpacity < 1;
    floor.mesh.material.depthWrite = mirrorOpacity >= 1;
    floor.mesh.material.opacity = mirrorOpacity;
    const material = floor.mesh.material as THREE.ShaderMaterial;
    if (material?.uniforms?.['color']?.value) {
      material.uniforms['color'].value.set(applyMirrorParsed.rgb);
    }
    if (material?.uniforms?.['opacity']) {
      material.uniforms['opacity'].value = mirrorOpacity;
    }

    if (floor.shadowCatcher) {
      const shadowOpacity =
        typeof surface.shadowOpacity === 'number' && Number.isFinite(surface.shadowOpacity)
          ? Math.max(0, Math.min(1, surface.shadowOpacity))
          : 0.3;
      floor.shadowCatcher.material.opacity = shadowOpacity;
      floor.shadowCatcher.material.needsUpdate = true;
      setFloorDepthEdgeMaterialState(floor.shadowCatcher.material, depthEdge);
    }
    if (floor.gridLines) floor.gridLines.visible = false;
    return;
  }

  if (surface.type !== 'physical') return;
  const material = floor.mesh.material as THREE.MeshPhysicalMaterial;
  const surfaceColorParsed = parseHexColor(surface.color ?? '#1a222d');
  material.color.set(surfaceColorParsed.rgb);
  material.toneMapped = true;
  const opacity = (typeof surface.opacity === 'number' ? surface.opacity : 1) * surfaceColorParsed.alpha;
  material.opacity = opacity;
  material.transparent = opacity < 1;
  material.depthWrite = opacity >= 1;
  material.metalness = typeof surface.metalness === 'number' ? surface.metalness : 0.08;
  material.roughness = typeof surface.roughness === 'number' ? surface.roughness : 0.92;
  material.reflectivity = typeof surface.reflectivity === 'number' ? surface.reflectivity : material.reflectivity;
  material.clearcoat = typeof surface.clearcoat === 'number' ? surface.clearcoat : material.clearcoat;
  material.clearcoatRoughness =
    typeof surface.clearcoatRoughness === 'number' ? surface.clearcoatRoughness : material.clearcoatRoughness;
  const emissiveParsed = parseHexColor(surface.emissive ?? '#000000');
  material.emissive.set(emissiveParsed.rgb);
  material.emissiveIntensity = (typeof surface.emissiveIntensity === 'number' ? surface.emissiveIntensity : 1) * emissiveParsed.alpha;
  material.envMapIntensity = surface.pattern === 'grid'
    ? 0
    : typeof surface.envMapIntensity === 'number'
      ? surface.envMapIntensity
      : 1;
  material.aoMapIntensity = typeof surface.aoMapIntensity === 'number' ? surface.aoMapIntensity : 1;
  material.displacementScale = typeof surface.displacementScale === 'number' ? surface.displacementScale : 1;
  material.displacementBias = typeof surface.displacementBias === 'number' ? surface.displacementBias : 0;
  material.wireframe = typeof surface.wireframe === 'boolean' ? surface.wireframe : false;
  if (typeof surface.normalScale?.[0] === 'number' && typeof surface.normalScale?.[1] === 'number') {
    material.normalScale.set(surface.normalScale[0], surface.normalScale[1]);
  } else {
    material.normalScale.set(1, 1);
  }

  if (surface.pattern === 'grid') {
    if (!floor.isUsingGridPattern) {
      clearPhysicalMaps(material);
      resetMaterialMapKeys(floor);
      floor.isUsingGridPattern = true;
    }
    // Grid fill should stay color-faithful (not light-tinted) and non-reflective.
    // Shadows are rendered by a dedicated ShadowMaterial catcher mesh.
    const fillColorParsed = parseHexColor(surface.color ?? '#1a222d');
    material.color.set('#000000');
    material.emissive.set(fillColorParsed.rgb);
    material.emissiveIntensity = 1;
    material.toneMapped = false;
    material.metalness = 0;
    material.roughness = 1;
    material.clearcoat = 0;
    material.clearcoatRoughness = 1;
    material.reflectivity = 0;

    ensureShadowCatcher(floor, refs.scene);
    floor.mesh.receiveShadow = false;
    const fillOpacityRaw = surface.gridFillOpacity ?? surface.opacity ?? 0;
    const fillOpacity =
      Number.isFinite(fillOpacityRaw)
        ? clamp01(fillOpacityRaw) * fillColorParsed.alpha
        : 0;
    material.transparent = fillOpacity < 1;
    material.opacity = fillOpacity;
    material.depthWrite = fillOpacity >= 1;
    material.needsUpdate = true;
    if (floor.shadowCatcher) {
      floor.shadowCatcher.visible = true;
      floor.shadowCatcher.material.opacity = 0.35;
      floor.shadowCatcher.material.needsUpdate = true;
      setFloorDepthEdgeMaterialState(floor.shadowCatcher.material, depthEdge);
    }
    ensureGridLines(floor, surface, scale);
    if (floor.gridLines) {
      setFloorDepthEdgeMaterialState(floor.gridLines.material, depthEdge);
    }
    if (state.debug) {
      ensureDebugZeroLine(floor);
    } else {
      disposeDebugZeroLine(floor);
    }
    return;
  }

  if (floor.isUsingGridPattern) {
    disposeGridLines(floor);
    floor.isUsingGridPattern = false;
  }
  if (!floor.isMirror && floor.shadowCatcher) {
    disposeShadowCatcher(floor, refs.scene);
  }
  floor.mesh.receiveShadow = true;

  // --- Material preset handling ---
  const presetName = surface.surfaceMaterial;
  if (presetName) {
    const presetApplied = applyFloorPresetMaterial(floor, surface, refs);
    if (presetApplied) return;
    // Preset not ready yet — fall through to existing material path.
  } else if (floor.presetMaterial) {
    // surfaceMaterial was removed — dispose preset material and revert.
    disposePresetMaterial(floor);
    floor.lastSurfaceMaterial = null;
  }

  const loader = new THREE.TextureLoader();

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.textureUrl,
    'textureUrl',
    (texture) => {
      if (material.map) material.map.dispose();
      material.map = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.map) material.map.dispose();
      material.map = null;
      material.needsUpdate = true;
      floor.textureRepeat = undefined;
      floor.textureOffset = undefined;
      floor.textureRotation = undefined;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.normalMapUrl,
    'normalMapUrl',
    (texture) => {
      if (material.normalMap) material.normalMap.dispose();
      material.normalMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.normalMap) material.normalMap.dispose();
      material.normalMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.roughnessMapUrl,
    'roughnessMapUrl',
    (texture) => {
      if (material.roughnessMap) material.roughnessMap.dispose();
      material.roughnessMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.roughnessMap) material.roughnessMap.dispose();
      material.roughnessMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.metalnessMapUrl,
    'metalnessMapUrl',
    (texture) => {
      if (material.metalnessMap) material.metalnessMap.dispose();
      material.metalnessMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.metalnessMap) material.metalnessMap.dispose();
      material.metalnessMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.aoMapUrl,
    'aoMapUrl',
    (texture) => {
      if (material.aoMap) material.aoMap.dispose();
      material.aoMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.aoMap) material.aoMap.dispose();
      material.aoMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.displacementMapUrl,
    'displacementMapUrl',
    (texture) => {
      if (material.displacementMap) material.displacementMap.dispose();
      material.displacementMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.displacementMap) material.displacementMap.dispose();
      material.displacementMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.alphaMapUrl,
    'alphaMapUrl',
    (texture) => {
      if (material.alphaMap) material.alphaMap.dispose();
      material.alphaMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.alphaMap) material.alphaMap.dispose();
      material.alphaMap = null;
      material.needsUpdate = true;
    },
  );

  applyMapUrl(
    loader,
    floor,
    surface,
    surface.emissiveMapUrl,
    'emissiveMapUrl',
    (texture) => {
      if (material.emissiveMap) material.emissiveMap.dispose();
      material.emissiveMap = texture;
      material.needsUpdate = true;
    },
    () => {
      if (material.emissiveMap) material.emissiveMap.dispose();
      material.emissiveMap = null;
      material.needsUpdate = true;
    },
  );

  if (surface.textureUrl && material.map) {
    const repeatChanged = surface.textureRepeat !== floor.textureRepeat;
    const offsetChanged = surface.textureOffset !== floor.textureOffset;
    const rotationChanged = surface.textureRotation !== floor.textureRotation;
    if (repeatChanged || offsetChanged || rotationChanged) {
      applyTextureParams(material.map, surface);
      floor.textureRepeat = surface.textureRepeat;
      floor.textureOffset = surface.textureOffset;
      floor.textureRotation = surface.textureRotation;
    }
  }
}
