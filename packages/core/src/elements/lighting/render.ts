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
  directionals: Map<string, THREE.DirectionalLight>;
  glowPoint?: THREE.PointLight;
  strands: Map<string, THREE.PointLight[]>;
  points: Map<string, THREE.PointLight>;
  spots: Map<string, { light: THREE.SpotLight; target: THREE.Object3D }>;
  panels: Map<string, THREE.PointLight[]>;
  enabledById: Map<string, boolean>;
};

const LIGHTING_KEY = '__brewsite_lighting';
const DIRECTIONAL_SHADOW_RANGE = 260;
const DIRECTIONAL_SHADOW_NEAR = 0.5;
const DIRECTIONAL_SHADOW_FAR = 600;

const getCache = (scene: THREE.Scene): LightingCache => {
  const existing = scene.userData[LIGHTING_KEY] as LightingCache | undefined;
  if (existing) return existing;
  const created: LightingCache = {
    directionals: new Map(),
    strands: new Map(),
    points: new Map(),
    spots: new Map(),
    panels: new Map(),
    enabledById: new Map(),
  };
  scene.userData[LIGHTING_KEY] = created;
  return created;
};

const isLightEnabled = (cache: LightingCache, id: string): boolean =>
  cache.enabledById.get(id) ?? true;

export function setSceneLightEnabled(
  scene: THREE.Scene,
  lightId: string,
  enabled: boolean,
): void {
  const cache = getCache(scene);
  cache.enabledById.set(lightId, enabled);
}

export function isSceneLightEnabled(scene: THREE.Scene, lightId: string): boolean {
  const cache = getCache(scene);
  return isLightEnabled(cache, lightId);
}

export function clearSceneLightOverrides(scene: THREE.Scene): void {
  const cache = getCache(scene);
  cache.enabledById.clear();
}

export function applyLighting(state: SceneLighting, refs: LightingThreeRefs): void {
  const scene = refs.scene;
  const cache = getCache(scene);

  const intensityScale = state.intensityScale;

  // Apply ambient light
  if (!cache.ambient) {
    cache.ambient = new THREE.AmbientLight();
    scene.add(cache.ambient);
  }
  const ambientEnabled = isLightEnabled(cache, state.ambient.id ?? 'ambient-0');
  cache.ambient.color.set(state.ambient.color);
  cache.ambient.intensity = (ambientEnabled ? state.ambient.intensity : 0) * intensityScale;

  // Apply directional lights — keyed by id.
  // Index 0 is the primary (shadow-casting) light; subsequent lights are fill lights only.
  const directionalSpecs = state.directionals;
  const activeDirectionalIds = new Set(
    directionalSpecs.map((d, i) => d.id ?? `directional-${i}`),
  );
  for (const [id, light] of cache.directionals.entries()) {
    if (activeDirectionalIds.has(id)) continue;
    scene.remove(light);
    cache.directionals.delete(id);
  }
  for (let i = 0; i < directionalSpecs.length; i += 1) {
    const spec = directionalSpecs[i]!;
    const directionalId = spec.id ?? `directional-${i}`;
    const directionalEnabled = isLightEnabled(cache, directionalId);
    let light = cache.directionals.get(directionalId);
    if (!light) {
      light = new THREE.DirectionalLight();
      const isPrimary = i === 0;
      light.castShadow = isPrimary;
      if (isPrimary) {
        light.shadow.mapSize.set(1024, 1024);
      }
      cache.directionals.set(directionalId, light);
      scene.add(light);
    }
    light.color.set(spec.color);
    light.intensity = (directionalEnabled ? spec.intensity : 0) * intensityScale;
    light.position.set(spec.position[0], spec.position[1], spec.position[2]);
    // Only update shadow camera for the primary (index 0) light.
    if (i === 0 && light.castShadow) {
      const dirCam = light.shadow.camera as THREE.OrthographicCamera;
      // Wider bounds reduce shadow pop/disappear when camera pans across large scenes.
      dirCam.near = DIRECTIONAL_SHADOW_NEAR;
      dirCam.far = DIRECTIONAL_SHADOW_FAR;
      dirCam.left = -DIRECTIONAL_SHADOW_RANGE;
      dirCam.right = DIRECTIONAL_SHADOW_RANGE;
      dirCam.top = DIRECTIONAL_SHADOW_RANGE;
      dirCam.bottom = -DIRECTIONAL_SHADOW_RANGE;
    }
  }

  // Apply single glow point light (non-shadow-casting fill light).
  if (state.glowPoint) {
    const glowPointId = state.glowPoint.id ?? 'glow-point-0';
    const glowPointEnabled = isLightEnabled(cache, glowPointId);
    if (!cache.glowPoint) {
      cache.glowPoint = new THREE.PointLight();
      cache.glowPoint.castShadow = false;
      scene.add(cache.glowPoint);
    }
    cache.glowPoint.color.set(state.glowPoint.color);
    cache.glowPoint.intensity = (glowPointEnabled ? state.glowPoint.intensity : 0) * intensityScale;
    cache.glowPoint.position.set(
      state.glowPoint.position[0],
      state.glowPoint.position[1],
      state.glowPoint.position[2],
    );
    if (state.glowPoint.distance !== undefined) {
      cache.glowPoint.distance = state.glowPoint.distance;
    }
    if (state.glowPoint.decay !== undefined) {
      cache.glowPoint.decay = state.glowPoint.decay;
    }
    cache.glowPoint.visible = cache.glowPoint.intensity > 0;
  } else if (cache.glowPoint) {
    scene.remove(cache.glowPoint);
    cache.glowPoint = undefined;
  }

  // Apply light strands (point lights sampled along a curve).
  const strandSpecs = state.lightStrands ?? [];
  const activeStrandIds = new Set(strandSpecs.map((strand, index) => strand.id ?? `strand-${index}`));
  for (const [id, lights] of cache.strands.entries()) {
    if (activeStrandIds.has(id)) continue;
    for (const light of lights) scene.remove(light);
    cache.strands.delete(id);
  }
  for (const strand of strandSpecs) {
    const strandId = strand.id;
    const strandEnabled = isLightEnabled(cache, strandId);
    const count = Math.max(0, Math.round(strand.count));
    let lights = cache.strands.get(strandId);
    if (!lights) {
      lights = [];
      cache.strands.set(strandId, lights);
    }
    while (lights.length < count) {
      const strandLight = new THREE.PointLight();
      strandLight.castShadow = false;
      lights.push(strandLight);
      scene.add(strandLight);
    }
    while (lights.length > count) {
      const strandLight = lights.pop();
      if (strandLight) scene.remove(strandLight);
    }
    const strandPosition = strand.position ?? [0, 0, 0];
    for (let i = 0; i < count; i += 1) {
      const axis = strand.shape.kind === 'wave' ? 'xz' : (strand.shape.axis ?? 'xz');
      const shapeOffset = strand.shape.kind === 'wave' ? ([0, 0, 0] as [number, number, number]) : (strand.shape.offset ?? [0, 0, 0]);
      const setAxisPoint = (u: number, v: number): [number, number, number] => {
        if (axis === 'xy') return [u, v, 0];
        if (axis === 'yz') return [0, u, v];
        return [u, 0, v];
      };

      let local: [number, number, number];
      if (strand.shape.kind === 'wave') {
        const t = count <= 1 ? 0.5 : i / (count - 1);
        const length = strand.shape.curve.length ?? strand.shape.curve.width ?? 0;
        const x = (t - 0.5) * length;
        const y = strand.shape.curve.yOffset
          + strand.shape.curve.waveAmplitude * Math.sin(Math.PI * 2 * strand.shape.curve.waveFrequency * t);
        const z = strand.shape.curve.z
          + strand.shape.curve.depthAmplitude * Math.sin(Math.PI * 2 * strand.shape.curve.depthFrequency * t + strand.shape.curve.depthPhase);
        local = [x, y, z];
      } else if (strand.shape.kind === 'circle') {
        const t = count <= 0 ? 0 : i / count;
        const theta = Math.PI * 2 * t;
        const point = setAxisPoint(Math.cos(theta) * strand.shape.radius, Math.sin(theta) * strand.shape.radius);
        local = [point[0] + shapeOffset[0], point[1] + shapeOffset[1], point[2] + shapeOffset[2]];
      } else {
        const halfW = strand.shape.width / 2;
        const halfH = strand.shape.height / 2;
        const perimeter = Math.max(0.0001, 2 * (strand.shape.width + strand.shape.height));
        const t = count <= 0 ? 0 : i / count;
        let d = t * perimeter;
        let u = -halfW;
        let v = -halfH;
        if (d <= strand.shape.width) {
          u = -halfW + d;
          v = -halfH;
        } else if ((d -= strand.shape.width) <= strand.shape.height) {
          u = halfW;
          v = -halfH + d;
        } else if ((d -= strand.shape.height) <= strand.shape.width) {
          u = halfW - d;
          v = halfH;
        } else {
          d -= strand.shape.width;
          u = -halfW;
          v = halfH - Math.min(d, strand.shape.height);
        }
        const point = setAxisPoint(u, v);
        local = [point[0] + shapeOffset[0], point[1] + shapeOffset[1], point[2] + shapeOffset[2]];
      }
      const strandLight = lights[i]!;
      strandLight.color.set(strand.color);
      strandLight.intensity = (strandEnabled ? strand.intensity : 0) * intensityScale;
      strandLight.distance = strand.distance ?? 0;
      strandLight.decay = strand.decay ?? 1;
      strandLight.position.set(
        strandPosition[0] + local[0],
        strandPosition[1] + local[1],
        strandPosition[2] + local[2],
      );
      strandLight.visible = strandLight.intensity > 0;
    }
  }

  // Apply point lights
  const pointSpecs = state.points ?? [];
  const activePointIds = new Set(pointSpecs.map((pointSpec, index) => pointSpec.id ?? `point-${index}`));
  for (const [id, pointLight] of cache.points.entries()) {
    if (activePointIds.has(id)) continue;
    scene.remove(pointLight);
    cache.points.delete(id);
  }
  for (let i = 0; i < pointSpecs.length; i += 1) {
    const pointSpec = pointSpecs[i]!;
    const pointId = pointSpec.id ?? `point-${i}`;
    const pointEnabled = isLightEnabled(cache, pointId);
    let pointLight = cache.points.get(pointId);
    if (!pointLight) {
      pointLight = new THREE.PointLight();
      pointLight.castShadow = true;
      pointLight.shadow.mapSize.set(512, 512);
      cache.points.set(pointId, pointLight);
      scene.add(pointLight);
    }
    pointLight.color.set(pointSpec.color);
    pointLight.intensity = (pointEnabled ? pointSpec.intensity : 0) * intensityScale;
    pointLight.position.set(pointSpec.position[0], pointSpec.position[1], pointSpec.position[2]);
    pointLight.visible = pointLight.intensity > 0;
  }

  // Apply spot lights
  const spotSpecs = state.spots ?? [];
  const activeSpotIds = new Set(spotSpecs.map((spotSpec, index) => spotSpec.id ?? `spot-${index}`));
  for (const [id, entry] of cache.spots.entries()) {
    if (activeSpotIds.has(id)) continue;
    scene.remove(entry.light);
    scene.remove(entry.target);
    cache.spots.delete(id);
  }
  for (let i = 0; i < spotSpecs.length; i += 1) {
    const spotSpec = spotSpecs[i]!;
    const spotId = spotSpec.id ?? `spot-${i}`;
    const spotEnabled = isLightEnabled(cache, spotId);
    let entry = cache.spots.get(spotId);
    if (!entry) {
      const light = new THREE.SpotLight();
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      const target = new THREE.Object3D();
      scene.add(light);
      scene.add(target);
      light.target = target;
      entry = { light, target };
      cache.spots.set(spotId, entry);
    }
    const spotLight = entry.light;
    const target = entry.target;
    spotLight.color.set(spotSpec.color);
    spotLight.intensity = (spotEnabled ? spotSpec.intensity : 0) * intensityScale;
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
    spotLight.visible = spotLight.intensity > 0;
    target.updateMatrixWorld();
  }

  // Apply light panels
  const panelSpecs = state.panels ?? [];
  const activePanelIds = new Set(panelSpecs.map((panelSpec, index) => panelSpec.id ?? `panel-${index}`));
  for (const [id, lights] of cache.panels.entries()) {
    if (activePanelIds.has(id)) continue;
    for (const light of lights) scene.remove(light);
    cache.panels.delete(id);
  }
  for (const panelSpec of panelSpecs) {
    const panelId = panelSpec.id;
    const panelEnabled = isLightEnabled(cache, panelId);
    const desiredCount = panelSpec.rows * panelSpec.cols;
    let panelLights = cache.panels.get(panelId);
    if (!panelLights) {
      panelLights = [];
      cache.panels.set(panelId, panelLights);
    }
    while (panelLights.length < desiredCount) {
      const panelLight = new THREE.PointLight();
      // Panel lights can be numerous; shadow maps for each panel quickly exceed
      // fragment sampler limits on common GPUs (MAX_TEXTURE_IMAGE_UNITS=16).
      // Treat panels as fill lights only.
      panelLight.castShadow = false;
      panelLight.shadow.mapSize.set(256, 256);
      panelLights.push(panelLight);
      scene.add(panelLight);
    }
    while (panelLights.length > desiredCount) {
      const panelLight = panelLights.pop();
      if (panelLight) scene.remove(panelLight);
    }
    const baseColor = new THREE.Color(panelSpec.color ?? '#ffffff');
    const matrix = panelSpec.matrix ?? [];
    let panelIndex = 0;
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
        if (!panelEnabled) {
          panelIntensity = 0;
        }

        const panelLight = panelLights[panelIndex]!;
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
