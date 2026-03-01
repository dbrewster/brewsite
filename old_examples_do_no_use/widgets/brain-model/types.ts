export type BrainSubpartState = {
  id: string;
  enabled?: boolean;
  opacity?: number;
};

export type BrainState = {
  enabled: boolean;
  opacity: number;
  subparts: Record<string, BrainSubpartState>;
};
