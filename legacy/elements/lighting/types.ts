import type {Vec3} from '../model/types';

export type SceneLighting = {
  ambient: { intensity: number; color: string };
  directional: { intensity: number; color: string; position: Vec3 };
  points?: Array<{ intensity: number; color: string; position: Vec3 }>;
  spots?: Array<{
    intensity: number;
    color: string;
    position: Vec3;
    target: Vec3;
    angle: number;
    penumbra: number;
    distance?: number;
    decay?: number;
  }>;
  panels?: Array<{
    id: string;
    origin: Vec3;
    rows: number;
    cols: number;
    spacing: Vec3;
    intensity: number;
    distance?: number;
    decay?: number;
    color?: string;
    matrix?: number[];
  }>;
  intensityScale: number;
  color: string;
};
