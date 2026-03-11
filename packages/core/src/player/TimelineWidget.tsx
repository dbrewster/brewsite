// HUD timeline scrubber widget — pure React, no Three.js.

import type {ReactElement} from 'react';
import React, {useCallback, useRef, useState} from 'react';
import type {TimelineWidgetProps} from './TimelineWidgetTypes';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const THEMES = {
  dark: {
    track: 'rgba(255,255,255,0.05)',
    fill: 'rgba(255,255,255,0.1)',
    handle: '#ffffff',
    handleBorder: 'rgba(0,0,0,0.3)',
    tickMajor: 'rgba(255,255,255,0.6)',
    tickMinor: 'rgba(255,255,255,0.25)',
    label: 'rgba(255,255,255,0.7)',
    progress: 'rgba(255,255,255,0.5)',
    background: 'rgba(0,0,0,0.35)',
  },
  light: {
    track: 'rgba(0,0,0,0.15)',
    fill: 'rgba(0,0,0,0.1)',
    handle: '#333333',
    handleBorder: 'rgba(255,255,255,0.5)',
    tickMajor: 'rgba(0,0,0,0.55)',
    tickMinor: 'rgba(0,0,0,0.2)',
    label: 'rgba(0,0,0,0.6)',
    progress: 'rgba(0,0,0,0.4)',
    background: 'rgba(255,255,255,0.3)',
  },
};

export const TimelineWidget = ({
                                 engine,
                                 scenes,
                                 position = 'bottom',
                                 theme = 'dark',
                                 thickness = 44,
                                 majorTicks = 'scene',
                                 minorTicksPerScene = 0,
                                 showSceneLabels = true,
                                 showProgress = false,
                                 scrubEnabled = true,
                                 className,
                                 style,
                                 onSeek,
                               }: TimelineWidgetProps): ReactElement => {
  const colors = THEMES[theme];
  const isHorizontal = position === 'top' || position === 'bottom';
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubProgressRef = useRef(engine.progress);

  // Progress: use scrub override during drag, else engine progress
  const displayProgress = isScrubbing ? scrubProgressRef.current : engine.progress;

  // engine.sceneCount is the number of scenes (new field added to UseSceneEngineResult — see §6.2).
  // scenes?.length is preferred when provided; it also gives us scene labels.
  // Do NOT use engine.debug.sceneTrackTicks as a fallback — that is the total
  // number of pre-baked ticks (potentially 100+), not the scene count.
  const sceneCount = scenes?.length ?? engine.sceneCount ?? 1;
  const totalTicks = engine.sceneTrack?.ticks.length ?? 1;

  // ─── Seek logic ─────────────────────────────────────────────────────────

  const seekTo = useCallback((progress: number): void => {
    const clamped = clamp01(progress);
    scrubProgressRef.current = clamped;
    engine.setProgress(clamped);
    onSeek?.(clamped);
  }, [engine, onSeek]);

  const progressFromPointer = useCallback((e: PointerEvent | React.PointerEvent<HTMLDivElement>): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (isHorizontal) {
      return clamp01((e.clientX - rect.left) / rect.width);
    } else {
      return clamp01((e.clientY - rect.top) / rect.height);
    }
  }, [isHorizontal]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!scrubEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    const p = progressFromPointer(e);
    scrubProgressRef.current = p;
    seekTo(p);
  }, [scrubEnabled, progressFromPointer, seekTo]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isScrubbing) return;
    const p = progressFromPointer(e);
    scrubProgressRef.current = p;
    seekTo(p);
  }, [isScrubbing, progressFromPointer, seekTo]);

  const handlePointerUp = useCallback((): void => {
    setIsScrubbing(false);
  }, []);

  // ─── Tick mark generation ────────────────────────────────────────────────

  const tickMarks: Array<{ progress: number; isMajor: boolean; label?: string }> = [];

  if (majorTicks === 'scene' && sceneCount > 1) {
    for (let i = 0; i < sceneCount; i++) {
      const p = i / (sceneCount - 1);
      const label = scenes?.[i]?.id ?? `Scene ${i + 1}`;
      tickMarks.push({progress: p, isMajor: true, label});

      // Minor ticks
      if (minorTicksPerScene > 0 && i < sceneCount - 1) {
        for (let m = 1; m <= minorTicksPerScene; m++) {
          const mp = p + (m / (minorTicksPerScene + 1)) / (sceneCount - 1);
          tickMarks.push({progress: mp, isMajor: false});
        }
      }
    }
  } else if (majorTicks === 'frame' && totalTicks > 1) {
    for (let i = 0; i < totalTicks; i++) {
      tickMarks.push({progress: i / (totalTicks - 1), isMajor: true});
    }
  }

  // ─── Layout constants ────────────────────────────────────────────────────

  const trackPad = 16;   // px padding on each end of track
  const handleSize = 14; // px diameter of scrub handle
  const tickAreaHeight = showSceneLabels ? 20 : 0; // px above/beside track for labels
  const trackHeight = 22; // px height of the track bar itself

  void tickAreaHeight;
  const horizontalTicksUp = isHorizontal && position === 'bottom';

  const anchorStyle: React.CSSProperties = isHorizontal
    ? (position === 'top'
      ? {top: 0, left: 0, right: 0}
      : {bottom: 0, left: 0, right: 0})
    : (position === 'right'
      ? {right: 0, top: 0, bottom: 0}
      : {left: 0, top: 0, bottom: 0});

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    ...anchorStyle,
    width: isHorizontal ? '100%' : thickness,
    height: isHorizontal ? 'fit-content' : '100%',
    background: colors.background,
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: isHorizontal ? 'column' : 'row',
    alignItems: 'center',
    padding: `${trackPad}px`,
    boxSizing: 'border-box',
    userSelect: 'none',
    cursor: scrubEnabled ? 'pointer' : 'default',
    // CRITICAL: the HUD overlay parent has pointerEvents:'none'. We must re-enable
    // pointer events here so the scrub handle and track are actually interactive.
    pointerEvents: 'auto',
    ...style,
  };

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: isHorizontal ? '100%' : trackHeight,
    minWidth: isHorizontal ? '100%' : trackHeight,
    height: isHorizontal ? trackHeight : '100%',
    minHeight: isHorizontal ? trackHeight : '100%',
    background: colors.track,
    borderRadius: '2',
    flexShrink: 0,
  };

  const fillStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: isHorizontal ? `${displayProgress * 100}%` : '75%',
    height: isHorizontal ? '75%' : `${displayProgress * 100}%`,
    background: colors.fill,
    borderRadius: 2,
    pointerEvents: 'none',
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    borderRadius: '50%',
    background: colors.handle,
    border: `2px solid ${colors.handleBorder}`,
    boxSizing: 'border-box',
    transform: 'translate(-50%, -50%)',
    top: isHorizontal ? '50%' : `${displayProgress * 100}%`,
    left: isHorizontal ? `${displayProgress * 100}%` : '50%',
    cursor: 'grab',
    pointerEvents: 'none',
    transition: isScrubbing ? 'none' : 'left 0.05s, top 0.05s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Progress readout */}
      {showProgress && (
        <div style={{
          fontSize: 11, color: colors.progress, ...(
            position == 'right' ? {marginLeft: 4} :
              position == 'left' ? {marginRight: 4} :
                (position == 'bottom' ? {marginTop: 4} :
                  {marginBottom: 4})
          ), fontVariantNumeric: 'tabular-nums'
        }}>
          {(displayProgress * 100).toFixed(1)}%
        </div>
      )}

      {/* Track area */}
      <div
        ref={trackRef}
        style={{...trackStyle, position: 'relative', flex: 1}}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayProgress * 100)}
        aria-label="Scene progress"
        tabIndex={0}
      >
        {/* Fill */}
        <div style={fillStyle}/>

        {/* Tick marks */}
        {tickMarks.map((tick, i) => {
          const pct = `${tick.progress * 100}%`;
          const tickStyle: React.CSSProperties = {
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: pct,
            [isHorizontal ? (horizontalTicksUp ? 'bottom' : 'top') : 'left']: '50%',
            transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
            width: isHorizontal ? (tick.isMajor ? 2 : 1) : (tick.isMajor ? 10 : 6),
            height: isHorizontal ? (tick.isMajor ? 10 : 6) : (tick.isMajor ? 2 : 1),
            background: tick.isMajor ? colors.tickMajor : colors.tickMinor,
            pointerEvents: 'none',
          };
          return (
            <div key={i} style={tickStyle}>
              {tick.isMajor && showSceneLabels && tick.label && (
                <div style={{
                  position: 'absolute',
                  [isHorizontal ? (horizontalTicksUp ? 'bottom' : 'top') : 'left']: '100%',
                  [isHorizontal ? 'left' : 'top']: '50%',
                  transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
                  fontSize: 9,
                  color: colors.label,
                  whiteSpace: 'nowrap',
                  marginBottom: isHorizontal && horizontalTicksUp ? 4 : 0,
                  marginTop: isHorizontal && !horizontalTicksUp ? 4 : 0,
                  marginLeft: !isHorizontal ? 4 : 0,
                  pointerEvents: 'none',
                  maxWidth: 60,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {tick.label}
                </div>
              )}
            </div>
          );
        })}

        {/* Scrub handle */}
        {scrubEnabled && <div style={handleStyle}/>}
      </div>
    </div>
  );
};
