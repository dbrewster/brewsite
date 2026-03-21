// Global scene DSL for the docs site engine.
// All 14 demo scenes are consolidated here in documentation-section order.
// Each scene has a unique prefixed id and a ProgressManager scroll budget.

import type { ReactNode } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Floor,
  FloorPhysical,
  FloorMirror,
  Environment,
  EnvironmentHdri,
  ProgressManager,
} from '@brewsite/core';
import { Model, Playback, Animation } from '@brewsite/model';

/**
 * Scroll budget per scene in proportional units.
 * ScrollCaptureSection.height = SCENE_COUNT * SCROLL_UNITS_PER_SCENE.
 */
const SCROLL_UNITS_PER_SCENE = 1200;

/** Total number of scenes in the global docs engine. */
const SCENE_COUNT = 34;

/**
 * Total scroll height in pixels for the docs engine's ScrollCaptureSection.
 * Equals the sum of all scene ProgressManager scrollUnits values.
 */
export const TOTAL_SCROLL_PX: number = SCENE_COUNT * SCROLL_UNITS_PER_SCENE;

/**
 * Global scene DSL for the docs site.
 *
 * Scenes are ordered to match the documentation navigation. Each scene group
 * corresponds to a documentation section. All scene ids are globally unique
 * with a prefix identifying the originating demo.
 *
 * Scene groups (in nav order):
 * - basic-*      : Getting Started / Quick Start / Scene DSL (BasicSceneDemo)
 * - multi-*      : Multi-Scene / Scene DSL (MultiSceneDemo)
 * - transition-* : Transitions (TransitionEasingDemo)
 * - model-basic-*: Model element — basic (ModelBasicDemo)
 * - model-anim-* : Model element — animation (ModelAnimationDemo)
 * - cam-world-*  : Camera — world mode (CameraWorldDemo)
 * - cam-orbit-*  : Camera — orbit mode (CameraOrbitDemo)
 * - light-*      : Lighting element (LightingDemo)
 * - bg-*         : Background element (BackgroundDemo)
 * - env-*        : Environment element (EnvironmentDemo)
 * - floor-*      : Floor element (FloorReflectionDemo)
 * - hud-*        : HUD overlay (HudOverlayDemo)
 * - input-*      : Navigation / Actions (InputActionsDemo)
 * - var-*        : Hooks / Variable Store (VariableStoreDemo)
 */
export const DOCS_SCENES: ReactNode = (
  <>
    {/* ── Basic Scene (GettingStarted / QuickStart / SceneDsl) ─────────────── */}
    <Scene key="basic-s1" id="basic-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>

    {/* ── Multi-Scene (MultiScene / SceneDsl) ──────────────────────────────── */}
    <Scene key="multi-s1" id="multi-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="multi-s2" id="multi-s2">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"1rad"} polar={"1.2rad"} distance={6} />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.6} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.4} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="multi-s3" id="multi-s3">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[5, 3, 5]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#4488ff" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.8} metalness={0.6} roughness={0.4} />
      </Floor>
    </Scene>

    {/* ── Transitions (Transitions) ────────────────────────────────────────── */}
    <Scene key="transition-start" id="transition-start">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="transition-end" id="transition-end" transition="dissolve">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[3, 3, 6]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#8855ff" intensity={0.6} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.8} metalness={0.5} roughness={0.4} />
      </Floor>
    </Scene>

    {/* ── Model basic (Model element) ───────────────────────────────────────── */}
    <Scene key="model-basic-s1" id="model-basic-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
      <Model type="MaleDummy" id="model-basic-character" rotation={[0, 0, 0]}>
        <Playback>
          <Animation clipName="chat-relax-m" enabled clipRepeat />
        </Playback>
      </Model>
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.3} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="model-basic-s2" id="model-basic-s2">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={"0.8rad"} polar={"1.3rad"} distance={4} />
      <Model type="MaleDummy" id="model-basic-character" rotation={[0, "1.2rad", 0]}>
        <Playback>
          <Animation clipName="chat-relax-m" enabled clipRepeat />
        </Playback>
      </Model>
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
        <Directional color="#aaddff" intensity={0.8} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.4} metalness={0.3} roughness={0.6} />
      </Floor>
    </Scene>

    {/* ── Model animation (Model element — animation) ───────────────────────── */}
    <Scene key="model-anim-relaxed" id="model-anim-relaxed">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.9, 0]} />
      <Model type="MaleDummy" id="model-anim-character">
        <Playback>
          <Animation clipName="chat-relax-m" enabled clipRepeat />
        </Playback>
      </Model>
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="model-anim-active" id="model-anim-active">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0.9, 0]} azimuth={"0.4rad"} polar={"1.2rad"} distance={4} />
      <Model type="MaleDummy" id="model-anim-character">
        <Playback>
          <Animation clipName="standing_chat_m_270753" enabled clipRepeat />
        </Playback>
      </Model>
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
        <Directional color="#aaccff" intensity={0.8} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>

    {/* ── Camera world mode (Camera element) ───────────────────────────────── */}
    <Scene key="cam-world-s1" id="cam-world-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="cam-world-s2" id="cam-world-s2">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[-4, 3, 6]} target={[1, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="cam-world-s3" id="cam-world-s3">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 6, 4]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>

    {/* ── Camera orbit mode (Camera element) ───────────────────────────────── */}
    <Scene key="cam-orbit-s1" id="cam-orbit-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.0} polar={"1.2rad"} distance={8} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="cam-orbit-s2" id="cam-orbit-s2">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"1.5rad"} polar={"1rad"} distance={6} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="cam-orbit-s3" id="cam-orbit-s3">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"3rad"} polar={"0.8rad"} distance={8} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>

    {/* ── Lighting (Lighting element) ───────────────────────────────────────── */}
    <Scene key="light-ambient" id="light-ambient">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.6} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.4} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="light-directional" id="light-directional">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.3} />
        <Directional color="#ffeedd" intensity={1.2} position={[5, 8, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="light-blue" id="light-blue">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#2244bb" intensity={0.5} />
        <Directional color="#6699ff" intensity={1.0} position={[-5, 8, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="light-warm" id="light-warm">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffaa33" intensity={0.4} />
        <Directional color="#ffddaa" intensity={1.5} position={[5, 10, 0]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.5} />
      </Floor>
    </Scene>

    {/* ── Background (Background element) ───────────────────────────────────── */}
    <Scene key="bg-deep-blue" id="bg-deep-blue">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#4455ff" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="bg-purple" id="bg-purple">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#8844cc" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="bg-teal" id="bg-teal">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#44bbaa" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
    <Scene key="bg-dark-warm" id="bg-dark-warm">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffaa44" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>

    {/* ── Environment (Environment element) ────────────────────────────────── */}
    <Scene key="env-no-env" id="env-no-env">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.3rad"} polar={"1.1rad"} distance={7} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.8} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.3} metalness={0.3} roughness={0.7} />
      </Floor>
    </Scene>
    <Scene key="env-with-env" id="env-with-env">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"0.8rad"} polar={"1rad"} distance={7} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaccff" intensity={0.8} position={[5, 10, 5]} />
      </Lighting>
      <Environment enabled intensity={1.0}>
        <EnvironmentHdri url="/assets/envmaps/night.hdr" />
      </Environment>
      <Floor enabled>
        <FloorPhysical opacity={0.9} metalness={0.8} roughness={0.1} />
      </Floor>
    </Scene>

    {/* ── Floor (Floor element) ─────────────────────────────────────────────── */}
    <Scene key="floor-no-floor" id="floor-no-floor">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
    </Scene>
    <Scene key="floor-subtle" id="floor-subtle">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.3} metalness={0.2} roughness={0.8} />
      </Floor>
    </Scene>
    <Scene key="floor-reflective" id="floor-reflective">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#aaddff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorMirror mirrorOpacity={0.9} mirrorResolution={512} mirrorClipBias={0.003} />
      </Floor>
    </Scene>

    {/* ── HUD Overlay (HUD overview) ────────────────────────────────────────── */}
    <Scene key="hud-s1" id="hud-s1">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
      <div style={{ position: 'absolute', top: 24, left: 24, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
        Scene One
      </div>
    </Scene>
    <Scene key="hud-s2" id="hud-s2">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#4488ff" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
      </Floor>
      <div style={{ position: 'absolute', top: 24, left: 24, color: '#7bb3ff', fontSize: 20, fontWeight: 700 }}>
        Scene Two — Overlay Active
      </div>
      <div style={{ position: 'absolute', top: 56, left: 24, color: '#aaaacc', fontSize: 14 }}>
        Text overlays appear on scene transition
      </div>
    </Scene>

    {/* ── Input Actions (Navigation / Actions) ─────────────────────────────── */}
    <Scene key="input-scene" id="input-scene">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera
        mode="orbit"
        target={[0, 0, 0]}
        azimuth={0}
        polar={"1.2rad"}
        distance={6}
      />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.5} />
        <Directional color="#ffffff" intensity={0.8} position={[5, 10, 5]} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>

    {/* ── Variable Store (Hooks / Variable Store) ───────────────────────────── */}
    <Scene key="var-intro" id="var-intro">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
      </Floor>
    </Scene>
    <Scene key="var-detail" id="var-detail">
      <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={"1.2rad"} polar={"1.1rad"} distance={6} />
      <Lighting>
        <Ambient color="#4488ff" intensity={0.5} />
      </Lighting>
      <Floor enabled>
        <FloorPhysical opacity={0.6} metalness={0.5} roughness={0.5} />
      </Floor>
    </Scene>
  </>
);
