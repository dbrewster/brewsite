/**
 * Floor element Three.js renderer.
 * Excluded from test coverage - Three.js rendering logic.
 */

import type { FloorSurfaceMirror, FloorSurfacePhysical, SceneFloor } from './types';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export type FloorThreeRefs = {
  scene: THREE.Scene;
};

type FloorInstance = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  isMirror: boolean;
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
};

const FLOOR_KEY = '__brewsite_floor';
const ENV_KEY = '__brewsite_environment';
const FLOOR_BASE_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

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

const ensureMirrorOpacityShader = (material: THREE.Material): void => {
  const shader = material as THREE.ShaderMaterial;
  if (!shader.uniforms) return;
  if (!shader.uniforms['opacity']) {
    shader.uniforms['opacity'] = { value: 1 };
  }
  if (shader.fragmentShader && !shader.fragmentShader.includes('uniform float opacity')) {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'uniform sampler2D tDiffuse;',
        'uniform sampler2D tDiffuse;\n\t\tuniform float opacity;',
      )
      .replace(
        'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
        'vec3 blended = blendOverlay( base.rgb, color );\n\t\t\tgl_FragColor = vec4( blended * opacity, opacity );',
      );
    shader.needsUpdate = true;
  }
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
    scene.remove(existing.mesh);
    disposeFloor(scene);
  }

  const geometry = new THREE.PlaneGeometry(400, 400);
  let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  if (wantsMirror) {
    const mirrorColor = surface.mirrorColor ?? '#111111';
    mesh = new Reflector(geometry, {
      color: mirrorColor,
      textureWidth: mirrorResolution,
      textureHeight: mirrorResolution,
      clipBias: mirrorClipBias,
    }) as unknown as THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
    const mirrorOpacity = typeof surface.mirrorOpacity === 'number' ? surface.mirrorOpacity : 1;
    ensureMirrorOpacityShader(mesh.material);
    mesh.material.transparent = mirrorOpacity < 1;
    mesh.material.depthWrite = mirrorOpacity >= 1;
    mesh.material.opacity = mirrorOpacity;
    const originalOnBeforeRender = mesh.onBeforeRender?.bind(mesh);
    mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      const env = (scene as THREE.Scene).userData[ENV_KEY] as { raw?: THREE.Texture } | undefined;
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
        mirror.prevBackground = (scene as THREE.Scene).background as THREE.Texture | null;
        (scene as THREE.Scene).background = env.raw;
        if (typeof mirror.envIntensity === 'number') {
          const sceneAny = scene as unknown as { backgroundIntensity?: number };
          mirror.prevBackgroundIntensity =
            typeof sceneAny.backgroundIntensity === 'number' ? sceneAny.backgroundIntensity : null;
          sceneAny.backgroundIntensity = mirror.envIntensity;
        }
      }
      if (originalOnBeforeRender) {
        originalOnBeforeRender(renderer, scene, camera, geometry, material, group);
      }
      if (mirror?.useEnvBackground) {
        (scene as THREE.Scene).background = mirror.prevBackground ?? null;
        if (typeof mirror.prevBackgroundIntensity === 'number') {
          const sceneAny = scene as unknown as { backgroundIntensity?: number };
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
  scene.add(mesh);

  const instance: FloorInstance = {
    mesh,
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
) => {
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
  scene.remove(instance.mesh);
  const reflector = instance.mesh as unknown as { dispose?: () => void };
  if (typeof reflector.dispose === 'function') {
    reflector.dispose();
  }
  instance.mesh.geometry.dispose();
  disposeMaterial(instance.mesh.material);
  delete scene.userData[FLOOR_KEY];
};

export function applyFloor(state: SceneFloor, refs: FloorThreeRefs): void {
  const surface = state.surface;
  if (!state.enabled || !surface) {
    const existing = refs.scene.userData[FLOOR_KEY] as FloorInstance | undefined;
    if (existing?.mesh) existing.mesh.visible = false;
    return;
  }

  const floor = getOrCreateFloor(refs.scene, surface);
  floor.mesh.visible = true;
  if (floor.isMirror) {
    if (!surface || surface.type !== 'mirror') return;
    floor.mirrorUseEnvironmentBackground = surface.mirrorUseEnvironmentBackground === true;
    const userData = floor.mesh.userData as {
      __brewsite_mirror?: { useEnvBackground?: boolean; envIntensity?: number | null };
    };
    userData.__brewsite_mirror = userData.__brewsite_mirror ?? {};
    userData.__brewsite_mirror.useEnvBackground = floor.mirrorUseEnvironmentBackground;
    userData.__brewsite_mirror.envIntensity =
      typeof surface.mirrorEnvironmentIntensity === 'number' ? surface.mirrorEnvironmentIntensity : null;
    if (state.position) {
      floor.mesh.position.set(state.position[0], state.position[1], state.position[2]);
    }
    const rotation = resolveFloorRotation(state);
    floor.mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (typeof state.scale === 'number') {
      floor.mesh.scale.set(state.scale, state.scale, state.scale);
    }
    const mirrorOpacity = typeof surface.mirrorOpacity === 'number' ? surface.mirrorOpacity : 1;
    floor.mesh.material.transparent = mirrorOpacity < 1;
    floor.mesh.material.depthWrite = mirrorOpacity >= 1;
    floor.mesh.material.opacity = mirrorOpacity;
    const mirrorColor = surface.mirrorColor ?? '#111111';
    const material = floor.mesh.material as THREE.ShaderMaterial;
    if (material?.uniforms?.['color']?.value) {
      material.uniforms['color'].value.set(mirrorColor);
    }
    if (material?.uniforms?.['opacity']) {
      material.uniforms['opacity'].value = mirrorOpacity;
    }
    return;
  }

  if (!surface || surface.type !== 'physical') return;
  const material = floor.mesh.material as THREE.MeshPhysicalMaterial;
  if (surface.color) {
    material.color.set(surface.color);
  }
  if (typeof surface.opacity === 'number') {
    material.opacity = surface.opacity;
    material.transparent = surface.opacity < 1;
    material.depthWrite = surface.opacity >= 1;
  }
  if (typeof surface.metalness === 'number') {
    material.metalness = surface.metalness;
  }
  if (typeof surface.roughness === 'number') {
    material.roughness = surface.roughness;
  }
  if (typeof surface.reflectivity === 'number') {
    material.reflectivity = surface.reflectivity;
  }
  if (typeof surface.clearcoat === 'number') {
    material.clearcoat = surface.clearcoat;
  }
  if (typeof surface.clearcoatRoughness === 'number') {
    material.clearcoatRoughness = surface.clearcoatRoughness;
  }
  if (surface.emissive) {
    material.emissive.set(surface.emissive);
  }
  if (typeof surface.emissiveIntensity === 'number') {
    material.emissiveIntensity = surface.emissiveIntensity;
  }
  if (typeof surface.envMapIntensity === 'number') {
    material.envMapIntensity = surface.envMapIntensity;
  }
  if (typeof surface.normalScale?.[0] === 'number' && typeof surface.normalScale?.[1] === 'number') {
    material.normalScale.set(surface.normalScale[0], surface.normalScale[1]);
  }
  if (typeof surface.aoMapIntensity === 'number') {
    material.aoMapIntensity = surface.aoMapIntensity;
  }
  if (typeof surface.displacementScale === 'number') {
    material.displacementScale = surface.displacementScale;
  }
  if (typeof surface.displacementBias === 'number') {
    material.displacementBias = surface.displacementBias;
  }
  if (typeof surface.wireframe === 'boolean') {
    material.wireframe = surface.wireframe;
  }

  if (state.position) {
    floor.mesh.position.set(state.position[0], state.position[1], state.position[2]);
  }
  const rotation = resolveFloorRotation(state);
  floor.mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  if (typeof state.scale === 'number') {
    floor.mesh.scale.set(state.scale, state.scale, state.scale);
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
