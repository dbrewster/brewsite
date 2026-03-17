// Tests for the CSM material factory — TypeScript logic only, no render tests.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createPresetMaterial,
  applyMaterialApplication,
  updatePresetTextures,
} from '../materialFactory';
import type { PresetMaterialOptions } from '../materialFactory';
import type { LoadedMaterialTextures, MaterialPresetDefaults, MaterialApplication } from '../../../widget/materialTypes';

// ---------------------------------------------------------------------------
// Test doubles — real Three.js objects, no mocks
// ---------------------------------------------------------------------------

function makeTextures(): LoadedMaterialTextures {
  return {
    color: new THREE.Texture(),
    normal: new THREE.Texture(),
    roughness: new THREE.Texture(),
  };
}

const DEFAULTS: MaterialPresetDefaults = {
  metalness: 0.9,
  roughness: 0.4,
};

function makeOptions(overrides?: Partial<PresetMaterialOptions>): PresetMaterialOptions {
  return {
    textures: makeTextures(),
    defaults: DEFAULTS,
    projection: 'triplanar',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createPresetMaterial — triplanar
// ---------------------------------------------------------------------------

describe('createPresetMaterial (triplanar)', () => {
  it('returns a CustomShaderMaterial instance', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'triplanar' }));
    expect(mat).toBeDefined();
    expect(mat.uniforms).toBeDefined();
  });

  it('includes all application-control uniforms', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'triplanar' }));
    const u = mat.uniforms;
    expect(u.u_colorMap).toBeDefined();
    expect(u.u_normalMap).toBeDefined();
    expect(u.u_roughnessMap).toBeDefined();
    expect(u.u_texScale).toBeDefined();
    expect(u.u_colorMix).toBeDefined();
    expect(u.u_brightness).toBeDefined();
    expect(u.u_saturation).toBeDefined();
    expect(u.u_contrast).toBeDefined();
    expect(u.u_depthMix).toBeDefined();
    expect(u.u_roughnessMix).toBeDefined();
    expect(u.u_tint).toBeDefined();
    expect(u.u_normalStrength).toBeDefined();
  });

  it('sets texture uniforms from provided textures', () => {
    const textures = makeTextures();
    const mat = createPresetMaterial(makeOptions({ textures }));
    expect(mat.uniforms.u_colorMap.value).toBe(textures.color);
    expect(mat.uniforms.u_normalMap.value).toBe(textures.normal);
    expect(mat.uniforms.u_roughnessMap.value).toBe(textures.roughness);
  });

  it('has a vertexShader for triplanar mode', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'triplanar' }));
    expect(mat.vertexShader).toBeDefined();
    expect(mat.vertexShader).toContain('v_objPos');
  });

  it('has a fragmentShader with triplanarSample', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'triplanar' }));
    expect(mat.fragmentShader).toContain('triplanarSample');
  });
});

// ---------------------------------------------------------------------------
// createPresetMaterial — UV
// ---------------------------------------------------------------------------

describe('createPresetMaterial (uv)', () => {
  it('returns a CustomShaderMaterial instance', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'uv' }));
    expect(mat).toBeDefined();
    expect(mat.uniforms).toBeDefined();
  });

  it('includes all application-control uniforms', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'uv' }));
    const u = mat.uniforms;
    expect(u.u_colorMap).toBeDefined();
    expect(u.u_texScale).toBeDefined();
    expect(u.u_colorMix).toBeDefined();
    expect(u.u_brightness).toBeDefined();
    expect(u.u_saturation).toBeDefined();
    expect(u.u_contrast).toBeDefined();
    expect(u.u_depthMix).toBeDefined();
    expect(u.u_roughnessMix).toBeDefined();
    expect(u.u_tint).toBeDefined();
  });

  it('uses UV fragment shader without triplanarSample', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'uv' }));
    expect(mat.fragmentShader).toContain('vUv');
    expect(mat.fragmentShader).not.toContain('triplanarSample');
  });

  it('does not set a custom vertex shader for UV mode', () => {
    const mat = createPresetMaterial(makeOptions({ projection: 'uv' }));
    // UV mode relies on default CSM UV passthrough, so vertexShader may be empty or undefined
    if (mat.vertexShader) {
      expect(mat.vertexShader).not.toContain('v_objPos');
    }
  });
});

// ---------------------------------------------------------------------------
// Default values for omitted MaterialApplication fields
// ---------------------------------------------------------------------------

describe('default uniform values', () => {
  it('uses correct defaults when no application is provided', () => {
    const mat = createPresetMaterial(makeOptions());
    const u = mat.uniforms;
    expect(u.u_texScale.value).toBe(0.12);
    expect(u.u_colorMix.value).toBe(1.0);
    expect(u.u_brightness.value).toBe(1.0);
    expect(u.u_saturation.value).toBe(1.0);
    expect(u.u_contrast.value).toBe(0.0);
    expect(u.u_depthMix.value).toBe(1.0);
    expect(u.u_roughnessMix.value).toBe(1.0);
    expect(u.u_normalStrength.value).toBe(0.5);
  });

  it('uses white tint when tint is not provided', () => {
    const mat = createPresetMaterial(makeOptions());
    const tint = mat.uniforms.u_tint.value as THREE.Color;
    expect(tint.r).toBe(1);
    expect(tint.g).toBe(1);
    expect(tint.b).toBe(1);
  });

  it('applies custom application values as uniforms', () => {
    const application: MaterialApplication = {
      colorMix: 0.5,
      brightness: 1.5,
      saturation: 0.8,
      contrast: 0.2,
      depthMix: 0.7,
      roughnessMix: 0.3,
      texScale: 0.25,
      tint: '#ff0000',
    };
    const mat = createPresetMaterial(makeOptions({ application }));
    const u = mat.uniforms;
    expect(u.u_colorMix.value).toBe(0.5);
    expect(u.u_brightness.value).toBe(1.5);
    expect(u.u_saturation.value).toBe(0.8);
    expect(u.u_contrast.value).toBe(0.2);
    expect(u.u_depthMix.value).toBe(0.7);
    expect(u.u_roughnessMix.value).toBe(0.3);
    expect(u.u_texScale.value).toBe(0.25);
    const tint = u.u_tint.value as THREE.Color;
    expect(tint.r).toBe(1);
    expect(tint.g).toBe(0);
    expect(tint.b).toBe(0);
  });

  it('derives normalStrength from depthMix', () => {
    const application: MaterialApplication = { depthMix: 0.5 };
    const mat = createPresetMaterial(makeOptions({ application }));
    expect(mat.uniforms.u_normalStrength.value).toBeCloseTo(0.25); // 0.5 * 0.5
  });
});

// ---------------------------------------------------------------------------
// Auto-upgrade: iridescence > 0 → MeshPhysicalMaterial base
// ---------------------------------------------------------------------------

describe('iridescence auto-upgrade', () => {
  it('uses MeshStandardMaterial base when no iridescence', () => {
    const mat = createPresetMaterial(makeOptions());
    // CSM stores the base material class internally — we can verify by checking
    // that iridescence property is not present on standard materials
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(typeof baseMat.metalness).toBe('number');
    // MeshPhysicalMaterial-specific property should not exist on standard
    const physCheck = mat as unknown as Record<string, unknown>;
    expect(physCheck.iridescence === undefined || physCheck.iridescence === 0).toBe(true);
  });

  it('uses MeshPhysicalMaterial base when iridescence > 0', () => {
    const application: MaterialApplication = {
      iridescence: 0.8,
      iridescenceIOR: 1.5,
      iridescenceThicknessRange: [200, 400],
    };
    const mat = createPresetMaterial(makeOptions({ application }));
    const physMat = mat as unknown as THREE.MeshPhysicalMaterial;
    expect(physMat.iridescence).toBe(0.8);
    expect(physMat.iridescenceIOR).toBe(1.5);
    expect(physMat.iridescenceThicknessRange).toEqual([200, 400]);
  });

  it('applies default iridescence params when only iridescence is set', () => {
    const application: MaterialApplication = { iridescence: 0.5 };
    const mat = createPresetMaterial(makeOptions({ application }));
    const physMat = mat as unknown as THREE.MeshPhysicalMaterial;
    expect(physMat.iridescence).toBe(0.5);
    expect(physMat.iridescenceIOR).toBe(1.3);
    expect(physMat.iridescenceThicknessRange).toEqual([100, 400]);
  });

  it('does not upgrade when iridescence is 0', () => {
    const application: MaterialApplication = { iridescence: 0 };
    const mat = createPresetMaterial(makeOptions({ application }));
    const physCheck = mat as unknown as Record<string, unknown>;
    expect(physCheck.iridescence === undefined || physCheck.iridescence === 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyMaterialApplication
// ---------------------------------------------------------------------------

describe('applyMaterialApplication', () => {
  let mat: ReturnType<typeof createPresetMaterial>;

  beforeEach(() => {
    mat = createPresetMaterial(makeOptions());
  });

  it('updates colorMix uniform', () => {
    applyMaterialApplication(mat, { colorMix: 0.3 });
    expect(mat.uniforms.u_colorMix.value).toBe(0.3);
  });

  it('updates brightness uniform', () => {
    applyMaterialApplication(mat, { brightness: 1.8 });
    expect(mat.uniforms.u_brightness.value).toBe(1.8);
  });

  it('updates saturation uniform', () => {
    applyMaterialApplication(mat, { saturation: 0.0 });
    expect(mat.uniforms.u_saturation.value).toBe(0.0);
  });

  it('updates contrast uniform', () => {
    applyMaterialApplication(mat, { contrast: -0.5 });
    expect(mat.uniforms.u_contrast.value).toBe(-0.5);
  });

  it('updates depthMix and derived normalStrength', () => {
    applyMaterialApplication(mat, { depthMix: 0.4 });
    expect(mat.uniforms.u_depthMix.value).toBe(0.4);
    expect(mat.uniforms.u_normalStrength.value).toBeCloseTo(0.2);  // 0.5 * 0.4
  });

  it('updates roughnessMix uniform', () => {
    applyMaterialApplication(mat, { roughnessMix: 0.6 });
    expect(mat.uniforms.u_roughnessMix.value).toBe(0.6);
  });

  it('updates texScale uniform', () => {
    applyMaterialApplication(mat, { texScale: 0.5 });
    expect(mat.uniforms.u_texScale.value).toBe(0.5);
  });

  it('updates tint uniform', () => {
    applyMaterialApplication(mat, { tint: '#00ff00' });
    const tint = mat.uniforms.u_tint.value as THREE.Color;
    expect(tint.r).toBe(0);
    expect(tint.g).toBe(1);
    expect(tint.b).toBe(0);
  });

  it('does not change uniforms for fields not specified', () => {
    const before = mat.uniforms.u_brightness.value;
    applyMaterialApplication(mat, { colorMix: 0.1 });
    expect(mat.uniforms.u_brightness.value).toBe(before);
  });

  it('updates base color when baseColor is provided', () => {
    applyMaterialApplication(mat, { colorMix: 1 }, '#0000ff');
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(baseMat.color.getHexString()).toBe('0000ff');
  });

  it('updates iridescence on physical material', () => {
    const physMat = createPresetMaterial(makeOptions({
      application: { iridescence: 0.5 },
    }));
    applyMaterialApplication(physMat, { iridescence: 0.9 });
    const phys = physMat as unknown as THREE.MeshPhysicalMaterial;
    expect(phys.iridescence).toBe(0.9);
  });

  it('updates iridescenceIOR on physical material', () => {
    const physMat = createPresetMaterial(makeOptions({
      application: { iridescence: 0.5 },
    }));
    applyMaterialApplication(physMat, { iridescenceIOR: 2.0 });
    const phys = physMat as unknown as THREE.MeshPhysicalMaterial;
    expect(phys.iridescenceIOR).toBe(2.0);
  });

  it('updates iridescenceThicknessRange on physical material', () => {
    const physMat = createPresetMaterial(makeOptions({
      application: { iridescence: 0.5 },
    }));
    applyMaterialApplication(physMat, { iridescenceThicknessRange: [200, 500] });
    const phys = physMat as unknown as THREE.MeshPhysicalMaterial;
    expect(phys.iridescenceThicknessRange).toEqual([200, 500]);
  });
});

// ---------------------------------------------------------------------------
// updatePresetTextures
// ---------------------------------------------------------------------------

describe('updatePresetTextures', () => {
  it('swaps texture uniforms to new texture set', () => {
    const mat = createPresetMaterial(makeOptions());
    const newTextures = makeTextures();

    updatePresetTextures(mat, newTextures);

    expect(mat.uniforms.u_colorMap.value).toBe(newTextures.color);
    expect(mat.uniforms.u_normalMap.value).toBe(newTextures.normal);
    expect(mat.uniforms.u_roughnessMap.value).toBe(newTextures.roughness);
  });

  it('works for both projection modes', () => {
    const triMat = createPresetMaterial(makeOptions({ projection: 'triplanar' }));
    const uvMat = createPresetMaterial(makeOptions({ projection: 'uv' }));
    const newTextures = makeTextures();

    updatePresetTextures(triMat, newTextures);
    updatePresetTextures(uvMat, newTextures);

    expect(triMat.uniforms.u_colorMap.value).toBe(newTextures.color);
    expect(uvMat.uniforms.u_colorMap.value).toBe(newTextures.color);
  });
});

// ---------------------------------------------------------------------------
// baseColor and baseOpacity
// ---------------------------------------------------------------------------

describe('baseColor and baseOpacity', () => {
  it('applies baseColor to the material', () => {
    const mat = createPresetMaterial(makeOptions({ baseColor: '#ff8800' }));
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(baseMat.color.getHexString()).toBe('ff8800');
  });

  it('applies baseOpacity and sets transparent', () => {
    const mat = createPresetMaterial(makeOptions({ baseOpacity: 0.5 }));
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(baseMat.opacity).toBe(0.5);
    expect(baseMat.transparent).toBe(true);
  });

  it('does not set transparent when opacity is 1', () => {
    const mat = createPresetMaterial(makeOptions({ baseOpacity: 1.0 }));
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(baseMat.transparent).toBe(false);
  });

  it('uses preset defaults for metalness and roughness', () => {
    const mat = createPresetMaterial(makeOptions());
    const baseMat = mat as unknown as THREE.MeshStandardMaterial;
    expect(baseMat.metalness).toBe(DEFAULTS.metalness);
    expect(baseMat.roughness).toBe(DEFAULTS.roughness);
  });
});
