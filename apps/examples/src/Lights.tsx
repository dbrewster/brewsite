import {
  Ambient,
  clearSceneTrackCache,
  Directional,
  Lighting,
  type ScrollStageHandle,
  type ThemeFamily,
  type ThemePolarity,
  TimelineWidget,
  useSceneEngineContext
} from "@brewsite/core";
import { bundles } from '@brewsite/themes';
import {config} from "./settings";
import {JSX, RefObject, useCallback, useEffect, useMemo, useRef, useState} from "react";

export const Lights = () => (
  <Lighting intensityScale={1}>
    <Ambient intensity={2.6} color="#8899cc"/>
    <Directional id={'d1'} intensity={.4} color={config.lightColor} position={[config.lightOffset, config.lightOffset, 10]}/>
    <Directional id={'d2'} intensity={.4} color={config.lightColor} position={[0, config.lightOffset, 10]}/>
    <Directional id={'d3'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, config.lightOffset, 10]}/>
    <Directional id={'d4'} intensity={.4} color={config.lightColor} position={[config.lightOffset, 0, 10]}/>
    <Directional id={'d5'} intensity={.4} color={config.lightColor} position={[0, 0, 10]}/>
    <Directional id={'d6'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, 0, 10]}/>
    <Directional id={'d7'} intensity={.4} color={config.lightColor} position={[config.lightOffset, -config.lightOffset, 10]}/>
    <Directional id={'d8'} intensity={.4} color={config.lightColor} position={[0, -config.lightOffset, 10]}/>
    <Directional id={'d9'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, -config.lightOffset, 10]}/>
  </Lighting>
)

// ─── Theme families — derived from registered bundles, no manual maintenance ──
const THEME_FAMILIES = Object.keys(bundles) as ThemeFamily[];

/** Convert a camelCase family key to a human-readable label. */
function familyLabel(family: string): string {
  return family
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── Theme toggle component ──────────────────────────────────────────────────

export interface ThemeToggleProps {
  /** Called when polarity changes. */
  onPolarityChange: (polarity: ThemePolarity) => void;
  /** Called when family changes. */
  onFamilyChange: (family: ThemeFamily) => void;
  /** Initial polarity. Defaults to localStorage or 'dark'. */
  initialPolarity?: ThemePolarity;
  /** Initial family. Defaults to localStorage or 'darkGlass'. */
  initialFamily?: ThemeFamily;
  /** Persist selections to localStorage. */
  persist?: boolean;
}

/**
 * Combined theme toggle: polarity (dark/light) button + family selector dropdown.
 * Positioned absolute at top-right. Calls clearSceneTrackCache() on each change
 * so the scene recompiles with the new theme.
 */
export const ThemeToggle = ({
  onPolarityChange,
  onFamilyChange,
  initialPolarity,
  initialFamily,
  persist = false,
}: ThemeToggleProps) => {
  const [polarity, setPolarity] = useState<ThemePolarity>(
    initialPolarity ?? (localStorage.getItem('themePolarity') as ThemePolarity) ?? 'dark',
  );
  const [family, setFamily] = useState<ThemeFamily>(
    initialFamily ?? (localStorage.getItem('themeFamily') as ThemeFamily) ?? 'darkGlass',
  );

  useEffect(() => {
    if (!initialPolarity) {
      const pol = (localStorage.getItem('themePolarity') as ThemePolarity) || 'light'
      onPolarityChange(pol)
      setPolarity(pol)
    }
    if (!initialFamily) {
      const fam = (localStorage.getItem('themeFamily') as ThemeFamily) || 'darkGlass'
      onFamilyChange(fam)
      setFamily(fam)
    }
  }, [initialPolarity, initialFamily])

  const handlePolarityToggle = useCallback((): void => {
    clearSceneTrackCache();
    setPolarity((prev) => {
      const next: ThemePolarity = prev === 'dark' ? 'light' : 'dark';
      onPolarityChange(next);
      if (persist) localStorage.setItem('themePolarity', next);
      return next;
    });
  }, [onPolarityChange, persist]);

  const handleFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    clearSceneTrackCache();
    const next = e.target.value as ThemeFamily;
    setFamily(next);
    onFamilyChange(next);
    if (persist) localStorage.setItem('themeFamily', next);
  }, [onFamilyChange, persist]);

  const isDark = polarity === 'dark';

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Family selector */}
      <select
        value={family}
        onChange={handleFamilyChange}
        aria-label="Theme family"
        style={{
          background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
          borderRadius: 8,
          padding: '5px 8px',
          color: isDark ? '#ffffff' : '#111111',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {THEME_FAMILIES.map((f) => (
          <option key={f} value={f}>{familyLabel(f)}</option>
        ))}
      </select>

      {/* Polarity toggle */}
      <button
        onClick={handlePolarityToggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
          borderRadius: 8,
          cursor: 'pointer',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#ffffff' : '#111111',
          fontSize: 18,
          lineHeight: 1,
          transition: 'background 0.15s ease',
        }}
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
    </div>
  );
};

// ─── Legacy toggle (backward compat) ─────────────────────────────────────────

export interface LightDarkToggleProps {
  setPolarity: (polarity: ThemePolarity) => void;
  initialPolarity?: ThemePolarity;
  savePolarityInLocalStorage: boolean;
}

export const LightDarkToggle = ({initialPolarity, setPolarity, savePolarityInLocalStorage}: LightDarkToggleProps) => {
  const [polarity, setThemePolarity] = useState<ThemePolarity>(initialPolarity || (localStorage.getItem('themePolarity') as ThemePolarity) || 'light');

  useEffect(() => {
    if (!initialPolarity) {
      const pol = (localStorage.getItem('themePolarity') as ThemePolarity) || 'light'
      setThemePolarity(pol)
      setPolarity(pol)
    }
  }, [initialPolarity])

  const handlePolarityToggle = useCallback((): void => {
    clearSceneTrackCache();
    setThemePolarity((prev) => {
      const newPolarity: ThemePolarity = prev === 'dark' ? 'light' : 'dark';
      setPolarity(newPolarity);
      if (savePolarityInLocalStorage) {
        localStorage.setItem('themePolarity', newPolarity);
      }
      return newPolarity;
    });
  }, [setPolarity, savePolarityInLocalStorage]);

  return (
    <button
      onClick={handlePolarityToggle}
      aria-label={polarity === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 1000,
        background: polarity === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        border: polarity === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
        borderRadius: 8,
        cursor: 'pointer',
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: polarity === 'dark' ? '#ffffff' : '#111111',
        fontSize: 18,
        lineHeight: 1,
        transition: 'background 0.15s ease',
      }}
    >
      {polarity === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}


type ChartProgressIndicatorProps = {
  scrollStageRef: RefObject<ScrollStageHandle | null>;
  polarity: ThemePolarity;
};

export function ChartProgressIndicator({ scrollStageRef, polarity }: ChartProgressIndicatorProps): JSX.Element {
  const engine = useSceneEngineContext();
  const handleSeek = useCallback((progress: number): void => {
    const rawProgress = engine.progressMapper ? engine.progressMapper.inverse(progress) : progress;
    if (scrollStageRef.current) {
      scrollStageRef.current.scrollToProgress(rawProgress);
      return;
    }
    engine.setProgress(progress);
  }, [engine, scrollStageRef]);

  return (
    <TimelineWidget
      engine={engine}
      theme={polarity === 'light' ? 'light' : 'dark'}
      position="bottom"
      thickness={36}
      majorTicks="scene"
      minorTicksPerScene={10}
      showSceneLabels={false}
      showProgress
      scrubEnabled
      onSeek={handleSeek}
      style={{ zIndex: 20, left: 0, right: 0, bottom: 0, borderRadius: 10 }}
    />
  );
}
