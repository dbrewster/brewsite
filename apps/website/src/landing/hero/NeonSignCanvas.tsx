import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';

export function NeonSignCanvas(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);
    scene.fog = new THREE.Fog(0x050810, 25, 90);

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 1.5, 18);
    camera.lookAt(0, 0, 0);

    // ── Materials ─────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e1220,
      metalness: 0.88,
      roughness: 0.28,
      envMapIntensity: 0.6,
    });

    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x080b14,
      metalness: 0.96,
      roughness: 0.05,
      envMapIntensity: 1.0,
    });

    const metalMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e2840,
      metalness: 0.99,
      roughness: 0.18,
    });

    // ── Geometry — Back wall ──────────────────────────────────────────────
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 35), wallMat);
    wall.position.set(0, 4, -14);
    scene.add(wall);

    // ── Geometry — Side walls ─────────────────────────────────────────────
    const sideWallGeo = new THREE.PlaneGeometry(30, 35);

    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-20, 4, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(20, 4, 0);
    scene.add(rightWall);

    // ── Geometry — Floor ─────────────────────────────────────────────────
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7;
    scene.add(floor);

    // ── Geometry — Metal frame bars around sign area ─────────────────────
    const barMat = metalMat;

    // Top bar
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 0.6), barMat);
    topBar.position.set(0, 7.0, -13.6);
    scene.add(topBar);

    // Bottom bar
    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 0.6), barMat);
    bottomBar.position.set(0, -2.5, -13.6);
    scene.add(bottomBar);

    // Left bar
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 10.5, 0.6), barMat);
    leftBar.position.set(-13.7, 2.25, -13.6);
    scene.add(leftBar);

    // Right bar
    const rightBar = leftBar.clone();
    rightBar.position.x = 13.7;
    scene.add(rightBar);

    // Corner bolts (spheres at bar intersections)
    const boltGeo = new THREE.SphereGeometry(0.55, 12, 8);
    const boltMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3550, metalness: 1, roughness: 0.1 });
    const boltPositions: [number, number][] = [[-13.7, 7.0], [13.7, 7.0], [-13.7, -2.5], [13.7, -2.5]];
    for (const [bx, by] of boltPositions) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(bx, by, -13.3);
      scene.add(bolt);
    }

    // Rivet rows — top and bottom bars
    const rivetGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const rivetMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4860, metalness: 0.99, roughness: 0.15 });
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const rv = new THREE.Mesh(rivetGeo, rivetMat);
      rv.position.set(i * 1.9, 7.0, -13.1);
      scene.add(rv);
      const rvb = rv.clone();
      rvb.position.y = -2.5;
      scene.add(rvb);
    }

    // ── Lighting ──────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x080d1a, 2.0);
    scene.add(ambient);

    // Warm industrial key (upper-left)
    const warmLight = new THREE.PointLight(0xff8800, 5, 60, 1.5);
    warmLight.position.set(-14, 12, 8);
    warmLight.castShadow = true;
    scene.add(warmLight);

    // Cool fill (upper-right)
    const coolLight = new THREE.PointLight(0x0055ff, 4, 55, 1.5);
    coolLight.position.set(14, 10, 6);
    scene.add(coolLight);

    // Sign backlight (subtle cyan bloom)
    const signLight = new THREE.PointLight(0x00ddff, 1.5, 25, 2);
    signLight.position.set(0, 2, -12);
    scene.add(signLight);

    // Ceiling strip fill
    const ceilingLight = new THREE.PointLight(0x203060, 3.5, 40, 1.2);
    ceilingLight.position.set(0, 18, 0);
    scene.add(ceilingLight);

    // ── Animation loop ────────────────────────────────────────────────────
    let frameId: number;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.008;

      // Very slow, barely-perceptible camera drift
      camera.position.x = Math.sin(t * 0.18) * 0.35;
      camera.position.y = 1.5 + Math.sin(t * 0.27) * 0.18;
      camera.lookAt(0, 0, 0);

      // Subtle warm light flicker (industrial atmosphere)
      warmLight.intensity = 5 + Math.sin(t * 7.3) * 0.15 + Math.sin(t * 13.1) * 0.08;

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
