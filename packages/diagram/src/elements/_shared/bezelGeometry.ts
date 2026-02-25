// Shared WebGL utility — Three.js only, no React, no compiler imports.

import * as THREE from 'three';

export type BezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

const BEZEL_DEPTH = 0.25;

const MATERIALS: Record<Exclude<BezelVariant, 'none' | 'thin'>, THREE.MeshStandardMaterial> = {
  dark: new THREE.MeshStandardMaterial({
    color: '#111111',
    metalness: 0.8,
    roughness: 0.3,
    transparent: true,
  }),
  light: new THREE.MeshStandardMaterial({
    color: '#e0e0e0',
    metalness: 0.4,
    roughness: 0.4,
    transparent: true,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: '#888888',
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
  }),
};

const cloneMaterial = (material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial =>
  material.clone();

export function createBezel(
  variant: BezelVariant,
  contentWidth: number,
  contentHeight: number,
  thickness: number,
): THREE.Group {
  const group = new THREE.Group();
  if (variant === 'none') return group;

  const effectiveThickness = variant === 'thin' ? thickness * 0.4 : thickness;
  const materialBase = variant === 'thin' ? MATERIALS.dark : MATERIALS[variant];

  const topGeom = new THREE.BoxGeometry(
    contentWidth + effectiveThickness * 2,
    effectiveThickness,
    BEZEL_DEPTH,
  );
  const sideGeom = new THREE.BoxGeometry(
    effectiveThickness,
    contentHeight,
    BEZEL_DEPTH,
  );

  const top = new THREE.Mesh(topGeom, cloneMaterial(materialBase));
  top.position.y = contentHeight / 2 + effectiveThickness / 2;
  const bottom = new THREE.Mesh(topGeom, cloneMaterial(materialBase));
  bottom.position.y = -(contentHeight / 2 + effectiveThickness / 2);

  const left = new THREE.Mesh(sideGeom, cloneMaterial(materialBase));
  left.position.x = -(contentWidth / 2 + effectiveThickness / 2);
  const right = new THREE.Mesh(sideGeom, cloneMaterial(materialBase));
  right.position.x = contentWidth / 2 + effectiveThickness / 2;

  group.add(top, bottom, left, right);
  return group;
}
