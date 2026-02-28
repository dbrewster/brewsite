/**
 * Lighting element Three.js renderer.
 * Excluded from test coverage - Three.js rendering logic.
 */

import * as THREE from 'three';
import type { SceneLighting } from './types';

export type LightingThreeRefs = {
  scene: THREE.Scene;
};

type LightingCache = {
  ambient?: THREE.AmbientLight;
  directional?: THREE.DirectionalLight;
  points: THREE.PointLight[];
  spots: THREE.SpotLight[];
  spotTargets: THREE.Object3D[];
  panels: THREE.PointLight[];
};

const LIGHTING_KEY = '__brewsite_lighting';
const DIRECTIONAL_SHADOW_RANGE = 260;
const DIRECTIONAL_SHADOW_NEAR = 0.5;
const DIRECTIONAL_SHADOW_FAR = 600;

const getCache = (scene: THREE.Scene): LightingCache => {
  const existing = scene.userData[LIGHTING_KEY] as LightingCache | undefined;
  if (existing) return existing;
  const created: LightingCache = {
    points: [],
    spots: [],
    spotTargets: [],
    panels: [],
  };
  scene.userData[LIGHTING_KEY] = created;
  return created;
};

export function applyLighting(state: SceneLighting, refs: LightingThreeRefs): void {
  const scene = refs.scene;
  const cache = getCache(scene);

  const intensityScale = state.intensityScale;

  // Apply ambient light
  if (!cache.ambient) {
    cache.ambient = new THREE.AmbientLight();
    scene.add(cache.ambient);
  }
  cache.ambient.color.set(state.ambient.color);
  cache.ambient.intensity = state.ambient.intensity * intensityScale;

  // Apply directional light
  if (!cache.directional) {
    cache.directional = new THREE.DirectionalLight();
    cache.directional.castShadow = true;
    cache.directional.shadow.mapSize.set(1024, 1024);
    scene.add(cache.directional);
  }
  const directionalLight = cache.directional;
  directionalLight.color.set(state.directional.color);
  directionalLight.intensity = state.directional.intensity * intensityScale;
  directionalLight.position.set(
    state.directional.position[0],
    state.directional.position[1],
    state.directional.position[2]
  );
  const dirCam = directionalLight.shadow.camera as THREE.OrthographicCamera;
  // Wider bounds reduce shadow pop/disappear when camera pans across large scenes.
  dirCam.near = DIRECTIONAL_SHADOW_NEAR;
  dirCam.far = DIRECTIONAL_SHADOW_FAR;
  dirCam.left = -DIRECTIONAL_SHADOW_RANGE;
  dirCam.right = DIRECTIONAL_SHADOW_RANGE;
  dirCam.top = DIRECTIONAL_SHADOW_RANGE;
  dirCam.bottom = -DIRECTIONAL_SHADOW_RANGE;

  // Apply point lights
  const pointSpecs = state.points ?? [];
  while (cache.points.length < pointSpecs.length) {
    const pointLight = new THREE.PointLight();
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.set(512, 512);
    cache.points.push(pointLight);
    scene.add(pointLight);
  }
  while (cache.points.length > pointSpecs.length) {
    const pointLight = cache.points.pop();
    if (pointLight) scene.remove(pointLight);
  }
  for (let i = 0; i < pointSpecs.length; i += 1) {
    const pointSpec = pointSpecs[i];
    const pointLight = cache.points[i];
    pointLight.color.set(pointSpec.color);
    pointLight.intensity = pointSpec.intensity * intensityScale;
    pointLight.position.set(pointSpec.position[0], pointSpec.position[1], pointSpec.position[2]);
  }

  // Apply spot lights
  const spotSpecs = state.spots ?? [];
  while (cache.spots.length < spotSpecs.length) {
    const spotLight = new THREE.SpotLight();
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.set(1024, 1024);
    const target = new THREE.Object3D();
    cache.spots.push(spotLight);
    cache.spotTargets.push(target);
    scene.add(spotLight);
    scene.add(target);
    spotLight.target = target;
  }
  while (cache.spots.length > spotSpecs.length) {
    const spotLight = cache.spots.pop();
    const target = cache.spotTargets.pop();
    if (spotLight) scene.remove(spotLight);
    if (target) scene.remove(target);
  }
  for (let i = 0; i < spotSpecs.length; i += 1) {
    const spotSpec = spotSpecs[i];
    const spotLight = cache.spots[i];
    const target = cache.spotTargets[i];
    spotLight.color.set(spotSpec.color);
    spotLight.intensity = spotSpec.intensity * intensityScale;
    spotLight.position.set(spotSpec.position[0], spotSpec.position[1], spotSpec.position[2]);
    target.position.set(spotSpec.target[0], spotSpec.target[1], spotSpec.target[2]);
    spotLight.angle = spotSpec.angle;
    spotLight.penumbra = spotSpec.penumbra;
    if (spotSpec.distance !== undefined) {
      spotLight.distance = spotSpec.distance;
    }
    if (spotSpec.decay !== undefined) {
      spotLight.decay = spotSpec.decay;
    }
    target.updateMatrixWorld();
  }

  // Apply light panels
  const panelSpecs = state.panels ?? [];
  const desiredPanelLights = panelSpecs.reduce((total, panel) => total + panel.rows * panel.cols, 0);
  while (cache.panels.length < desiredPanelLights) {
    const panelLight = new THREE.PointLight();
    panelLight.castShadow = true;
    panelLight.shadow.mapSize.set(256, 256);
    cache.panels.push(panelLight);
    scene.add(panelLight);
  }
  while (cache.panels.length > desiredPanelLights) {
    const panelLight = cache.panels.pop();
    if (panelLight) scene.remove(panelLight);
  }

  let panelIndex = 0;
  for (const panelSpec of panelSpecs) {
    const baseColor = new THREE.Color(panelSpec.color ?? '#ffffff');
    const matrix = panelSpec.matrix ?? [];
    for (let row = 0; row < panelSpec.rows; row += 1) {
      for (let col = 0; col < panelSpec.cols; col += 1) {
        const index = row * panelSpec.cols + col;
        const x = panelSpec.origin[0] + col * panelSpec.spacing[0];
        const y = panelSpec.origin[1] + row * panelSpec.spacing[1];
        const z = panelSpec.origin[2] + col * panelSpec.spacing[2];

        let panelLightColor = baseColor;
        let panelIntensity = panelSpec.intensity * intensityScale;

        if (matrix[index] !== undefined) {
          const value = matrix[index] as number;
          const r = (value >> 24) & 0xff;
          const g = (value >> 16) & 0xff;
          const b = (value >> 8) & 0xff;
          const a = value & 0xff;
          panelLightColor = new THREE.Color(r / 255, g / 255, b / 255);
          panelIntensity *= a / 255;
        }

        const panelLight = cache.panels[panelIndex];
        panelLight.color.copy(panelLightColor);
        panelLight.intensity = panelIntensity;
        panelLight.position.set(x, y, z);
        if (panelSpec.distance !== undefined) {
          panelLight.distance = panelSpec.distance;
        }
        if (panelSpec.decay !== undefined) {
          panelLight.decay = panelSpec.decay;
        }
        panelLight.visible = panelIntensity > 0;
        panelIndex += 1;
      }
    }
  }
}
