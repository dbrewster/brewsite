export type LogoSpec = {
  id: string;
  label?: string;
  color?: string;
};

export type LogoRotatorConfig = {
  logos: LogoSpec[];
  intervalMs: number;
  holdMultiplier?: (logoId: string) => number;
  order?: string[];
};

export type LogoRotatorState = {
  currentId: string;
  nextId: string;
  elapsedMs: number;
  progress: number;
};
