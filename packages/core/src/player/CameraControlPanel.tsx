/**
 * @internal Development-only component. Not part of the stable public API.
 * May change or be removed without a major version bump.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import * as THREE from 'three';
import { useSceneEngineContext } from './EngineContext';

type Vec3 = [number, number, number];

const clampNumber = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const toVec3 = (vec: THREE.Vector3): Vec3 => [vec.x, vec.y, vec.z];

export type CameraControlPanelProps = {
  className?: string;
  style?: CSSProperties;
};

export const CameraControlPanel = ({
  className,
  style,
}: CameraControlPanelProps): ReactElement => {
  const engine = useSceneEngineContext();
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState<Vec3>([0, 0, 0]);
  const [target, setTarget] = useState<Vec3>([0, 0, 0]);
  const [up, setUp] = useState<Vec3>([0, 1, 0]);
  const [fov, setFov] = useState(45);
  const [near, setNear] = useState(0.1);
  const [far, setFar] = useState(2000);
  const [exposure, setExposure] = useState(1);
  const [hasSynced, setHasSynced] = useState(false);

  const syncFromCamera = useCallback(() => {
    const camera = engine.getCamera();
    if (!camera) return;
    const renderer = engine.getRenderer();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const distance = Math.max(10, camera.position.length());
    const targetVec = camera.position.clone().add(dir.multiplyScalar(distance));
    setPosition(toVec3(camera.position));
    setTarget(toVec3(targetVec));
    setUp(toVec3(camera.up));
    setFov(clampNumber(camera.fov, 45));
    setNear(clampNumber(camera.near, 0.1));
    setFar(clampNumber(camera.far, 2000));
    setExposure(clampNumber(renderer?.toneMappingExposure ?? 1, 1));
    setHasSynced(true);
  }, [engine]);

  useEffect(() => {
    if (hasSynced) return;
    syncFromCamera();
  }, [hasSynced, syncFromCamera]);

  useEffect(() => {
    if (!enabled) {
      engine.setCameraOverride(null);
      return;
    }
    engine.setCameraOverride({
      enabled: true,
      position,
      target,
      up,
      fov,
      near,
      far,
      exposure,
    });
  }, [enabled, position, target, up, fov, near, far, exposure, engine]);

  const panelStyle: CSSProperties = useMemo(() => ({
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 6,
    width: 260,
    background: 'rgba(8, 12, 18, 0.85)',
    color: '#e6f0ff',
    border: '1px solid rgba(120, 170, 255, 0.25)',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
    ...style,
  }), [style]);

  const sectionTitleStyle: CSSProperties = { fontWeight: 600, marginBottom: 6 };
  const labelStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 };
  const inputStyle: CSSProperties = {
    width: 70,
    padding: '2px 4px',
    borderRadius: 4,
    border: '1px solid rgba(120, 170, 255, 0.3)',
    background: 'rgba(10, 16, 26, 0.9)',
    color: '#e6f0ff',
    fontSize: 12,
  };

  const updateVec3 = (
    next: number,
    idx: number,
    setter: React.Dispatch<React.SetStateAction<Vec3>>,
  ): void => {
    setter((prev) => {
      const copy: Vec3 = [prev[0], prev[1], prev[2]];
      copy[idx] = next;
      return copy;
    });
  };

  return (
    <div className={className} style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={sectionTitleStyle}>Camera Controls</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Override
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={syncFromCamera}
          style={{
            width: '100%',
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid rgba(120, 170, 255, 0.35)',
            background: 'rgba(30, 50, 80, 0.8)',
            color: '#e6f0ff',
            cursor: 'pointer',
          }}
        >
          Sync From Current View
        </button>
      </div>

      <div style={sectionTitleStyle}>Position</div>
      <div style={labelStyle}>
        <span>X</span>
        <input
          type="number"
          value={position[0]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 0, setPosition)}
          style={inputStyle}
        />
        <span>Y</span>
        <input
          type="number"
          value={position[1]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 1, setPosition)}
          style={inputStyle}
        />
        <span>Z</span>
        <input
          type="number"
          value={position[2]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 2, setPosition)}
          style={inputStyle}
        />
      </div>

      <div style={sectionTitleStyle}>Target</div>
      <div style={labelStyle}>
        <span>X</span>
        <input
          type="number"
          value={target[0]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 0, setTarget)}
          style={inputStyle}
        />
        <span>Y</span>
        <input
          type="number"
          value={target[1]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 1, setTarget)}
          style={inputStyle}
        />
        <span>Z</span>
        <input
          type="number"
          value={target[2]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 2, setTarget)}
          style={inputStyle}
        />
      </div>

      <div style={sectionTitleStyle}>Up</div>
      <div style={labelStyle}>
        <span>X</span>
        <input
          type="number"
          value={up[0]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 0, setUp)}
          style={inputStyle}
        />
        <span>Y</span>
        <input
          type="number"
          value={up[1]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 1, setUp)}
          style={inputStyle}
        />
        <span>Z</span>
        <input
          type="number"
          value={up[2]}
          step={0.1}
          onChange={(e) => updateVec3(Number(e.target.value), 2, setUp)}
          style={inputStyle}
        />
      </div>

      <div style={sectionTitleStyle}>Lens</div>
      <div style={labelStyle}>
        <span>FOV</span>
        <input
          type="number"
          value={fov}
          step={0.1}
          onChange={(e) => setFov(Number(e.target.value))}
          style={inputStyle}
        />
        <span>Near</span>
        <input
          type="number"
          value={near}
          step={0.1}
          onChange={(e) => setNear(Number(e.target.value))}
          style={inputStyle}
        />
        <span>Far</span>
        <input
          type="number"
          value={far}
          step={1}
          onChange={(e) => setFar(Number(e.target.value))}
          style={inputStyle}
        />
      </div>

      <div style={sectionTitleStyle}>Exposure</div>
      <div style={labelStyle}>
        <span>EV</span>
        <input
          type="number"
          value={exposure}
          step={0.05}
          onChange={(e) => setExposure(Number(e.target.value))}
          style={inputStyle}
        />
      </div>
    </div>
  );
};
