import type { LogoRotatorConfig, LogoRotatorState } from './types';

export type LogoRotator = {
  tick: (deltaMs: number) => LogoRotatorState;
  setIds: (ids: string[]) => void;
  setCurrent: (id: string) => void;
  getState: () => LogoRotatorState;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createLogoRotator = (ids: string[], config: Omit<LogoRotatorConfig, 'logos'>): LogoRotator => {
  let list = [...ids];
  let currentIndex = 0;
  let elapsedMs = 0;

  const normalize = () => {
    if (list.length === 0) return;
    currentIndex = clamp(currentIndex, 0, list.length - 1);
  };

  const resolveInterval = (id: string) => {
    const base = config.intervalMs;
    const multiplier = config.holdMultiplier ? config.holdMultiplier(id) : 1;
    return base * Math.max(0.1, multiplier || 1);
  };

  const getState = (): LogoRotatorState => {
    if (list.length === 0) {
      return { currentId: '', nextId: '', elapsedMs: 0, progress: 0 };
    }
    const currentId = list[currentIndex] ?? list[0] ?? '';
    const nextId = list[(currentIndex + 1) % list.length] ?? currentId;
    const interval = resolveInterval(currentId);
    const progress = interval > 0 ? clamp(elapsedMs / interval, 0, 1) : 1;
    return { currentId, nextId, elapsedMs, progress };
  };

  return {
    tick: (deltaMs) => {
      if (list.length === 0) return getState();
      const currentId = list[currentIndex] ?? list[0] ?? '';
      const interval = resolveInterval(currentId);
      elapsedMs += Math.max(0, deltaMs);
      if (interval > 0 && elapsedMs >= interval) {
        const steps = Math.floor(elapsedMs / interval);
        elapsedMs = elapsedMs % interval;
        currentIndex = (currentIndex + steps) % list.length;
      }
      return getState();
    },
    setIds: (idsNext) => {
      list = config.order && config.order.length ? config.order.filter((id) => idsNext.includes(id)) : [...idsNext];
      normalize();
      if (elapsedMs > 0 && list.length === 0) elapsedMs = 0;
    },
    setCurrent: (id) => {
      const index = list.indexOf(id);
      if (index >= 0) {
        currentIndex = index;
        elapsedMs = 0;
      }
    },
    getState,
  };
};
