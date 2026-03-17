// CSM-based material factory with triplanar and UV projection modes.

import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import type { MaterialApplication, LoadedMaterialTextures, MaterialPresetDefaults } from '../../widget/materialTypes';

/** Texture projection mode for preset materials. */
export type PresetMaterialProjection = 'triplanar' | 'uv';

/**
 * Options for creating a CSM preset material.
 * Both projection modes use CustomShaderMaterial with MaterialApplication controls as uniforms.
 */
export type PresetMaterialOptions = {
  textures: LoadedMaterialTextures;
  defaults: MaterialPresetDefaults;
  /** Texture projection mode. 'triplanar' for extruded geometry, 'uv' for flat/clean-UV geometry. */
  projection: PresetMaterialProjection;
  application?: MaterialApplication;
  baseColor?: string;
  baseOpacity?: number;
  /** Override preset default metalness. When provided, takes precedence over defaults.metalness. */
  metalness?: number;
  /** Override preset default roughness. When provided, takes precedence over defaults.roughness. */
  roughness?: number;
};

// ---------------------------------------------------------------------------
// GLSL shaders
// ---------------------------------------------------------------------------

const TRIPLANAR_VERTEX = /* glsl */ `
  varying vec3 v_objPos;
  varying vec3 v_objNormal;
  void main() {
    v_objPos = position;
    v_objNormal = normal;
  }
`;

const TRIPLANAR_FRAGMENT = /* glsl */ `
  uniform sampler2D u_colorMap;
  uniform sampler2D u_normalMap;
  uniform sampler2D u_roughnessMap;
  uniform float u_texScale;
  uniform float u_colorMix;
  uniform float u_brightness;
  uniform float u_saturation;
  uniform float u_contrast;
  uniform float u_depthMix;
  uniform float u_roughnessMix;
  uniform vec3 u_tint;
  uniform float u_normalStrength;

  varying vec3 v_objPos;
  varying vec3 v_objNormal;

  vec4 triplanarSample(sampler2D tex, vec3 pos, vec3 norm, float scale) {
    vec3 bf = pow(abs(norm), vec3(4.0));
    bf /= (bf.x + bf.y + bf.z);
    vec4 cX = texture2D(tex, pos.yz * scale);
    vec4 cY = texture2D(tex, pos.xz * scale);
    vec4 cZ = texture2D(tex, pos.xy * scale);
    return cX * bf.x + cY * bf.y + cZ * bf.z;
  }

  vec3 adjustSaturation(vec3 color, float sat) {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(lum), color, sat);
  }

  vec3 adjustContrast(vec3 color, float con) {
    return clamp((color - 0.5) * (1.0 + con) + 0.5, 0.0, 1.0);
  }

  void main() {
    // 1. Triplanar sample all maps
    vec4 texColor = triplanarSample(u_colorMap, v_objPos, v_objNormal, u_texScale);
    vec4 texNormal = triplanarSample(u_normalMap, v_objPos, v_objNormal, u_texScale);
    vec4 texRoughness = triplanarSample(u_roughnessMap, v_objPos, v_objNormal, u_texScale);

    // 2. Color pipeline: tint -> saturation -> contrast -> brightness -> mix
    vec3 col = texColor.rgb * u_tint;
    col = adjustSaturation(col, u_saturation);
    col = adjustContrast(col, u_contrast);
    col *= u_brightness;
    csm_DiffuseColor = vec4(mix(csm_DiffuseColor.rgb, col, u_colorMix), csm_DiffuseColor.a);

    // 3. Roughness
    csm_Roughness = mix(csm_Roughness, texRoughness.r, u_roughnessMix);

    // 4. Normal — blend geometry normal with texture normal
    vec3 texNorm = texNormal.rgb * 2.0 - 1.0;
    vec3 geomNormal = normalize(v_objNormal);
    csm_FragNormal = normalize(mix(geomNormal, texNorm, u_depthMix * u_normalStrength));

    // CSM_IRIDESCENCE_SLOT
  }
`;

const UV_FRAGMENT = /* glsl */ `
  uniform sampler2D u_colorMap;
  uniform sampler2D u_normalMap;
  uniform sampler2D u_roughnessMap;
  uniform float u_texScale;
  uniform float u_colorMix;
  uniform float u_brightness;
  uniform float u_saturation;
  uniform float u_contrast;
  uniform float u_depthMix;
  uniform float u_roughnessMix;
  uniform vec3 u_tint;
  uniform float u_normalStrength;

  vec3 adjustSaturation(vec3 color, float sat) {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(lum), color, sat);
  }

  vec3 adjustContrast(vec3 color, float con) {
    return clamp((color - 0.5) * (1.0 + con) + 0.5, 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv * u_texScale;

    // 1. UV sample all maps
    vec4 texColor = texture2D(u_colorMap, uv);
    vec4 texNormal = texture2D(u_normalMap, uv);
    vec4 texRoughness = texture2D(u_roughnessMap, uv);

    // 2. Color pipeline: tint -> saturation -> contrast -> brightness -> mix
    vec3 col = texColor.rgb * u_tint;
    col = adjustSaturation(col, u_saturation);
    col = adjustContrast(col, u_contrast);
    col *= u_brightness;
    csm_DiffuseColor = vec4(mix(csm_DiffuseColor.rgb, col, u_colorMix), csm_DiffuseColor.a);

    // 3. Roughness
    csm_Roughness = mix(csm_Roughness, texRoughness.r, u_roughnessMix);

    // 4. Normal
    vec3 texNorm = texNormal.rgb * 2.0 - 1.0;
    csm_FragNormal = normalize(mix(csm_Normal, texNorm, u_depthMix * u_normalStrength));

    // CSM_IRIDESCENCE_SLOT
  }
`;

// ---------------------------------------------------------------------------
// Default values for MaterialApplication fields
// ---------------------------------------------------------------------------

const DEFAULT_TEX_SCALE = 0.12;
const DEFAULT_COLOR_MIX = 1.0;
const DEFAULT_BRIGHTNESS = 1.0;
const DEFAULT_SATURATION = 1.0;
const DEFAULT_CONTRAST = 0.0;
const DEFAULT_DEPTH_MIX = 1.0;
const DEFAULT_ROUGHNESS_MIX = 1.0;
const DEFAULT_NORMAL_STRENGTH = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a CSS hex color string to a THREE.Color. Returns white for undefined/invalid. */
function parseTintColor(tint: string | undefined): THREE.Color {
  if (!tint) return new THREE.Color(1, 1, 1);
  try {
    return new THREE.Color(tint);
  } catch {
    return new THREE.Color(1, 1, 1);
  }
}

/** Build the full uniform object for both projection modes. */
function buildUniforms(
  textures: LoadedMaterialTextures,
  application: MaterialApplication | undefined,
): Record<string, { value: unknown }> {
  const depthMix = application?.depthMix ?? DEFAULT_DEPTH_MIX;
  const tintColor = parseTintColor(application?.tint);

  return {
    u_colorMap: { value: textures.color },
    u_normalMap: { value: textures.normal },
    u_roughnessMap: { value: textures.roughness },
    u_texScale: { value: application?.texScale ?? DEFAULT_TEX_SCALE },
    u_colorMix: { value: application?.colorMix ?? DEFAULT_COLOR_MIX },
    u_brightness: { value: application?.brightness ?? DEFAULT_BRIGHTNESS },
    u_saturation: { value: application?.saturation ?? DEFAULT_SATURATION },
    u_contrast: { value: application?.contrast ?? DEFAULT_CONTRAST },
    u_depthMix: { value: depthMix },
    u_roughnessMix: { value: application?.roughnessMix ?? DEFAULT_ROUGHNESS_MIX },
    u_tint: { value: tintColor },
    u_normalStrength: { value: DEFAULT_NORMAL_STRENGTH * depthMix },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a CSM material with the specified projection mode and all
 * MaterialApplication controls as uniforms.
 *
 * Both projection modes use CustomShaderMaterial — the only difference is
 * the vertex/fragment GLSL for texture coordinate computation.
 *
 * When `application.iridescence > 0`, uses MeshPhysicalMaterial as CSM base
 * for thin-film iridescence support. Otherwise uses MeshStandardMaterial.
 */
export function createPresetMaterial(options: PresetMaterialOptions): CustomShaderMaterial {
  const { textures, defaults, projection, application, baseColor, baseOpacity } = options;

  const usePhysical = (application?.iridescence ?? 0) > 0;
  const uniforms = buildUniforms(textures, application);

  const vertexShader = projection === 'triplanar' ? TRIPLANAR_VERTEX : undefined;
  const baseFragment = projection === 'triplanar' ? TRIPLANAR_FRAGMENT : UV_FRAGMENT;
  // Inject csm_Iridescence passthrough only for physical materials — CSM auto-enables
  // the iridescence shader path when it detects this variable in the shader string.
  // Without it, MeshPhysicalMaterial's iridescence property is silently ignored.
  const fragmentShader = usePhysical
    ? baseFragment.replace('// CSM_IRIDESCENCE_SLOT', 'csm_Iridescence = csm_Iridescence;')
    : baseFragment;

  const color = baseColor ? new THREE.Color(baseColor) : undefined;
  const opacity = baseOpacity ?? 1;
  // Theme-level metalness/roughness override preset defaults when provided.
  const metalness = options.metalness ?? defaults.metalness;
  const roughness = options.roughness ?? defaults.roughness;

  if (usePhysical) {
    const material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader,
      fragmentShader,
      uniforms,
      color,
      opacity,
      transparent: opacity < 1,
      metalness,
      roughness,
      side: THREE.FrontSide,
      iridescence: application!.iridescence!,
      iridescenceIOR: application?.iridescenceIOR ?? 1.3,
      iridescenceThicknessRange: application?.iridescenceThicknessRange
        ? [application.iridescenceThicknessRange[0], application.iridescenceThicknessRange[1]] as [number, number]
        : [100, 400] as [number, number],
    });
    return material;
  }

  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    vertexShader,
    fragmentShader,
    uniforms,
    color,
    opacity,
    transparent: opacity < 1,
    metalness,
    roughness,
    side: THREE.FrontSide,
  });
  return material;
}

/**
 * Updates application-time controls on an existing preset material.
 * Uniform-only — O(1), no GPU recompile, safe every frame, animatable.
 * Works identically for both projection modes.
 */
export function applyMaterialApplication(
  material: CustomShaderMaterial,
  application: MaterialApplication,
  baseColor?: string,
): void {
  const u = material.uniforms;
  if (!u) return;

  const depthMix = application.depthMix ?? DEFAULT_DEPTH_MIX;

  if (application.texScale !== undefined) u.u_texScale.value = application.texScale;
  if (application.colorMix !== undefined) u.u_colorMix.value = application.colorMix;
  if (application.brightness !== undefined) u.u_brightness.value = application.brightness;
  if (application.saturation !== undefined) u.u_saturation.value = application.saturation;
  if (application.contrast !== undefined) u.u_contrast.value = application.contrast;
  if (application.depthMix !== undefined) {
    u.u_depthMix.value = depthMix;
    u.u_normalStrength.value = DEFAULT_NORMAL_STRENGTH * depthMix;
  }
  if (application.roughnessMix !== undefined) u.u_roughnessMix.value = application.roughnessMix;
  if (application.tint !== undefined) u.u_tint.value = parseTintColor(application.tint);

  // Update base color on the underlying material
  if (baseColor) {
    const baseMat = material as unknown as THREE.MeshStandardMaterial;
    baseMat.color.set(baseColor);
  }

  // Update iridescence on physical materials
  if (application.iridescence !== undefined) {
    const physMat = material as unknown as THREE.MeshPhysicalMaterial;
    if (typeof physMat.iridescence === 'number') {
      physMat.iridescence = application.iridescence;
    }
  }
  if (application.iridescenceIOR !== undefined) {
    const physMat = material as unknown as THREE.MeshPhysicalMaterial;
    if (typeof physMat.iridescenceIOR === 'number') {
      physMat.iridescenceIOR = application.iridescenceIOR;
    }
  }
  if (application.iridescenceThicknessRange !== undefined) {
    const physMat = material as unknown as THREE.MeshPhysicalMaterial;
    if (physMat.iridescenceThicknessRange) {
      physMat.iridescenceThicknessRange = [
        application.iridescenceThicknessRange[0],
        application.iridescenceThicknessRange[1],
      ];
    }
  }
}

/**
 * Swaps the texture set on an existing preset material.
 * Use when the preset name changes but the geometry hasn't.
 * Works identically for both projection modes.
 */
export function updatePresetTextures(
  material: CustomShaderMaterial,
  textures: LoadedMaterialTextures,
): void {
  const u = material.uniforms;
  if (!u) return;

  u.u_colorMap.value = textures.color;
  u.u_normalMap.value = textures.normal;
  u.u_roughnessMap.value = textures.roughness;

  material.needsUpdate = true;
}
