import type {LogoSpec} from '../../components/LogoParticleField';
import {createLogoRotator, type LogoRotator, type LogoRotatorConfig, type LogoRotatorState} from './logoRotator';
import {loadLogoPalette, type LogoPalette} from './logoPalette';

export type LogoRotationState = {
  id: string;
  nextId: string;
  progress: number;
  elapsedMs: number;
  displayId: string;
  label: string;
  url: string;
  palette?: LogoPalette;
};

type LogoListener = (state: LogoRotationState) => void;

const emptyState: LogoRotationState = {
  id: '',
  nextId: '',
  progress: 0,
  elapsedMs: 0,
  displayId: '',
  label: '',
  url: '',
  palette: undefined,
};

const resolveLogo = (logos: LogoSpec[], id: string) => logos.find((logo) => logo.id === id);

export class LogoRotationRuntime {
  private rotator: LogoRotator;
  private logos: LogoSpec[];
  private state: LogoRotationState = { ...emptyState };
  private listeners = new Set<LogoListener>();
  private lastTimeSeconds: number | null = null;
  private paletteToken = 0;

  constructor(logos: LogoSpec[], config: LogoRotatorConfig) {
    this.logos = [...logos];
    this.rotator = createLogoRotator(this.logos.map((logo) => logo.id), config);
    const initial = this.rotator.getState();
    this.state = this.buildState(initial, this.state.displayId);
    this.refreshPalette(this.state.displayId || this.state.id);
  }

  getState(): LogoRotationState {
    return this.state;
  }

  subscribe(listener: LogoListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setLogos(next: LogoSpec[]): void {
    this.logos = [...next];
    this.rotator.setIds(this.logos.map((logo) => logo.id));
    this.updateFromRotator(this.rotator.getState());
  }

  setDisplayId(displayId: string): void {
    if (!displayId || displayId === this.state.displayId) return;
    this.state = {
      ...this.state,
      displayId,
      ...this.resolveDisplayFields(displayId),
    };
    this.refreshPalette(displayId);
    this.emit();
  }

  tick(deltaSeconds: number, timeSeconds?: number): LogoRotationState {
    const resolvedDeltaSeconds = Math.max(0, deltaSeconds);
    let deltaMs = resolvedDeltaSeconds * 1000;
    if (typeof timeSeconds === 'number') {
      if (this.lastTimeSeconds === null) {
        this.lastTimeSeconds = timeSeconds;
        deltaMs = 0;
      } else {
        deltaMs = Math.max(0, (timeSeconds - this.lastTimeSeconds) * 1000);
        this.lastTimeSeconds = timeSeconds;
      }
    } else {
      this.lastTimeSeconds = null;
    }

    const next = this.rotator.tick(deltaMs);
    this.updateFromRotator(next);
    return this.state;
  }

  private updateFromRotator(next: LogoRotatorState): void {
    const prev = this.state;
    const displayId = prev.displayId || next.currentId;
    this.state = this.buildState(next, displayId);
    if (prev.id !== this.state.id || prev.displayId !== this.state.displayId) {
      this.refreshPalette(this.state.displayId || this.state.id);
      this.emit();
      return;
    }
    this.state = {
      ...this.state,
      palette: prev.palette,
    };
  }

  private buildState(next: LogoRotatorState, displayId: string): LogoRotationState {
    const resolvedDisplayId = displayId || next.currentId;
    const displayFields = this.resolveDisplayFields(resolvedDisplayId);
    return {
      id: next.currentId,
      nextId: next.nextId,
      progress: next.progress,
      elapsedMs: next.elapsedMs,
      displayId: resolvedDisplayId,
      label: displayFields.label,
      url: displayFields.url,
      palette: this.state.palette,
    };
  }

  private resolveDisplayFields(displayId: string): { label: string; url: string } {
    const logo = resolveLogo(this.logos, displayId) ?? this.logos[0];
    return {
      label: logo?.label ?? '',
      url: logo?.url ?? '',
    };
  }

  private refreshPalette(displayId: string): void {
    const logo = resolveLogo(this.logos, displayId);
    if (!logo) return;
    const token = ++this.paletteToken;
    if (logo.colorOverride) {
      const { r, g, b } = logo.colorOverride;
      const palette = {
        primary: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
          .toString(16)
          .padStart(2, '0')}`,
        quadrants: [],
      };
      this.state = { ...this.state, palette };
      this.emit();
      return;
    }
    if (!logo.url) return;
    loadLogoPalette(logo.url)
      .then((palette) => {
        if (this.paletteToken !== token) return;
        this.state = { ...this.state, palette };
        this.emit();
      })
      .catch(() => {
        if (this.paletteToken !== token) return;
        this.state = { ...this.state, palette: undefined };
        this.emit();
      });
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
