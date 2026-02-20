/**
 * Lighting element Three.js renderer.
 * Excluded from test coverage - Three.js rendering logic.
 */

import * as THREE from 'three';
import type { SceneLighting } from './types';

export type LightingThreeRefs = {
  scene: THREE.Scene;
};

export function applyLighting(state: SceneLighting, refs: LightingThreeRefs): void {
  const scene = refs.scene;

  // Clean up existing lights added by this renderer (marked with a custom property)
  const lightsToRemove: THREE.Light[] = [];
  scene.traverse((obj: THREE.Object3D) => {
    if (
      (obj instanceof THREE.AmbientLight ||
        obj instanceof THREE.DirectionalLight ||
        obj instanceof THREE.PointLight ||
        obj instanceof THREE.SpotLight) &&
      (obj as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement
    ) {
      lightsToRemove.push(obj);
    }
  });
  for (const light of lightsToRemove) {
    scene.remove(light);
  }

  const intensityScale = state.intensityScale;

  // Apply ambient light
  const ambientLight = new THREE.AmbientLight(
    new THREE.Color(state.ambient.color),
    state.ambient.intensity * intensityScale
  );
  (ambientLight as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement = true;
  scene.add(ambientLight);

  // Apply directional light
  const directionalLight = new THREE.DirectionalLight(
    new THREE.Color(state.directional.color),
    state.directional.intensity * intensityScale
  );
  directionalLight.position.set(
    state.directional.position[0],
    state.directional.position[1],
    state.directional.position[2]
  );
  (directionalLight as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement = true;
  scene.add(directionalLight);

  // Apply point lights
  if (state.points && state.points.length > 0) {
    for (const pointSpec of state.points) {
      const pointLight = new THREE.PointLight(
        new THREE.Color(pointSpec.color),
        pointSpec.intensity * intensityScale
      );
      pointLight.position.set(pointSpec.position[0], pointSpec.position[1], pointSpec.position[2]);
      (pointLight as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement = true;
      scene.add(pointLight);
    }
  }

  // Apply spot lights
  if (state.spots && state.spots.length > 0) {
    for (const spotSpec of state.spots) {
      const spotLight = new THREE.SpotLight(
        new THREE.Color(spotSpec.color),
        spotSpec.intensity * intensityScale
      );
      spotLight.position.set(spotSpec.position[0], spotSpec.position[1], spotSpec.position[2]);
      spotLight.target.position.set(spotSpec.target[0], spotSpec.target[1], spotSpec.target[2]);
      spotLight.angle = spotSpec.angle;
      spotLight.penumbra = spotSpec.penumbra;
      if (spotSpec.distance !== undefined) {
        spotLight.distance = spotSpec.distance;
      }
      if (spotSpec.decay !== undefined) {
        spotLight.decay = spotSpec.decay;
      }
      (spotLight as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement = true;
      scene.add(spotLight);
      scene.add(spotLight.target);
      spotLight.target.updateMatrixWorld();
    }
  }

  // Apply light panels
  if (state.panels && state.panels.length > 0) {
    for (const panelSpec of state.panels) {
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

          const panelLight = new THREE.PointLight(panelLightColor, panelIntensity);
          panelLight.position.set(x, y, z);
          if (panelSpec.distance !== undefined) {
            panelLight.distance = panelSpec.distance;
          }
          if (panelSpec.decay !== undefined) {
            panelLight.decay = panelSpec.decay;
          }
          panelLight.visible = panelIntensity > 0;
          (panelLight as unknown as { __managedByLightingElement?: boolean }).__managedByLightingElement = true;
          scene.add(panelLight);
        }
      }
    }
  }
}
