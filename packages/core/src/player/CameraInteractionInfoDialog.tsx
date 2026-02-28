import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';

type CameraSnapshot = {
  readonly hasCamera: boolean;
  readonly hasOverride: boolean;
  readonly overrideEnabled: boolean;
  readonly position: readonly [number, number, number] | null;
  readonly up: readonly [number, number, number] | null;
  readonly fov: number | null;
  readonly near: number | null;
  readonly far: number | null;
  readonly exposure: number | null;
};

type PlatformKind = 'mac' | 'windows' | 'linux' | 'other';

type ShortcutRow = {
  readonly key: string;
  readonly action: string;
};

const detectPlatform = (): PlatformKind => {
  if (typeof navigator === 'undefined') return 'other';
  const uaPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform ?? '';
  const platform = `${uaPlatform} ${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) return 'mac';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux') || platform.includes('x11')) return 'linux';
  return 'other';
};

const getShortcutRows = (platform: PlatformKind): ShortcutRow[] => {
  if (platform === 'mac') {
    return [
      { key: '⌘ / Ctrl + Drag', action: 'Rotate' },
      { key: '⌘ + Shift + Drag', action: 'Rotate (axis lock)' },
      { key: 'Shift + Drag', action: 'Pan (truck)' },
      { key: '⌥ + Drag', action: 'Dolly (zoom)' },
      { key: 'Shift + Wheel', action: 'Pan (truck)' },
      { key: '⌘ + Wheel', action: 'Rotate' },
      { key: '⌥ + Wheel', action: 'Dolly (if enabled)' },
    ];
  }

  return [
    { key: 'Ctrl + Drag', action: 'Rotate' },
    { key: 'Ctrl + Shift + Drag', action: 'Rotate (axis lock)' },
    { key: 'Shift + Drag', action: 'Pan (truck)' },
    { key: 'Alt + Drag', action: 'Dolly (zoom)' },
    { key: 'Shift + Wheel', action: 'Pan (truck)' },
    { key: 'Ctrl + Wheel', action: 'Rotate' },
    { key: 'Alt + Wheel', action: 'Dolly (if enabled)' },
  ];
};

const round = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(2);

const vec3 = (value: readonly [number, number, number] | null): string =>
  value ? `${round(value[0])}, ${round(value[1])}, ${round(value[2])}` : 'n/a';

const sameVec3 = (
  a: readonly [number, number, number] | null,
  b: readonly [number, number, number] | null,
): boolean => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
};

const sameSnapshot = (a: CameraSnapshot, b: CameraSnapshot): boolean =>
  a.hasCamera === b.hasCamera &&
  a.hasOverride === b.hasOverride &&
  a.overrideEnabled === b.overrideEnabled &&
  sameVec3(a.position, b.position) &&
  sameVec3(a.up, b.up) &&
  a.fov === b.fov &&
  a.near === b.near &&
  a.far === b.far &&
  a.exposure === b.exposure;

const buildSnapshot = (engine: ReturnType<typeof useSceneEngineContext>): CameraSnapshot => {
  const override = engine.getCameraOverride();
  const camera = engine.getCamera();
  const renderer = engine.getRenderer();

  return {
    hasCamera: !!camera,
    hasOverride: !!override,
    overrideEnabled: override?.enabled === true,
    position: override?.position ?? (camera ? [camera.position.x, camera.position.y, camera.position.z] as const : null),
    up: override?.up ?? (camera ? [camera.up.x, camera.up.y, camera.up.z] as const : null),
    fov: override?.fov ?? camera?.fov ?? null,
    near: override?.near ?? camera?.near ?? null,
    far: override?.far ?? camera?.far ?? null,
    exposure: override?.exposure ?? renderer?.toneMappingExposure ?? null,
  };
};

export type CameraInteractionInfoDialogProps = {
  className?: string;
  style?: CSSProperties;
  pollMs?: number;
  title?: string;
};

export const CameraInteractionInfoDialog = ({
  className,
  style,
  pollMs = 200,
  title = 'Camera Interaction',
}: CameraInteractionInfoDialogProps): ReactElement => {
  const engine = useSceneEngineContext();
  const [snapshot, setSnapshot] = useState<CameraSnapshot>(() => buildSnapshot(engine));
  const [platform, setPlatform] = useState<PlatformKind>('other');

  useEffect(() => {
    const tick = (): void => {
      const next = buildSnapshot(engine);
      setSnapshot((prev) => (sameSnapshot(prev, next) ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, Math.max(16, pollMs));
    return () => window.clearInterval(id);
  }, [engine, pollMs]);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const panelStyle: CSSProperties = useMemo(() => ({
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 7,
    minWidth: 300,
    maxWidth: 420,
    background: 'rgba(8, 12, 18, 0.88)',
    color: '#e6f0ff',
    border: '1px solid rgba(120, 170, 255, 0.28)',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
    lineHeight: 1.45,
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
    ...style,
  }), [style]);

  const sectionTitleStyle: CSSProperties = { fontWeight: 700, margin: '8px 0 4px 0' };
  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    columnGap: 8,
    marginBottom: 2,
  };
  const keyStyle: CSSProperties = { opacity: 0.85 };
  const shortcutRows = getShortcutRows(platform);
  const platformLabel = platform === 'mac'
    ? 'macOS'
    : platform === 'windows'
      ? 'Windows'
      : platform === 'linux'
        ? 'Linux'
        : 'Unknown';

  return (
    <div className={className} style={panelStyle}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>

      <div style={rowStyle}><span style={keyStyle}>Camera</span><span>{snapshot.hasCamera ? 'ready' : 'missing'}</span></div>
      <div style={rowStyle}><span style={keyStyle}>Override</span><span>{snapshot.hasOverride ? (snapshot.overrideEnabled ? 'enabled' : 'present (disabled)') : 'none'}</span></div>
      <div style={rowStyle}><span style={keyStyle}>Position</span><span>{vec3(snapshot.position)}</span></div>
      <div style={rowStyle}><span style={keyStyle}>Up</span><span>{vec3(snapshot.up)}</span></div>
      <div style={rowStyle}><span style={keyStyle}>FOV / Near / Far</span><span>{`${round(snapshot.fov)} / ${round(snapshot.near)} / ${round(snapshot.far)}`}</span></div>
      <div style={rowStyle}><span style={keyStyle}>Exposure</span><span>{round(snapshot.exposure)}</span></div>

      <div style={sectionTitleStyle}>Interaction Keys</div>
      <div style={rowStyle}><span style={keyStyle}>Detected OS</span><span>{platformLabel}</span></div>
      {shortcutRows.map((row) => (
        <div key={`${row.key}:${row.action}`} style={rowStyle}>
          <span style={keyStyle}>{row.key}</span>
          <span>{row.action}</span>
        </div>
      ))}
    </div>
  );
};
