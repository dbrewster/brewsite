import type {RobotMotionCommand, RobotMotionScene} from './robotMotionTypes';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function resolveMotionCommands(options: {
  scrollScenes: RobotMotionScene[] | undefined;
  scrollProgress: number;
  timeSeconds: number;
}): RobotMotionCommand[] {
  const scenes = options.scrollScenes;
  if (!scenes || scenes.length === 0) return [];
  const commands: RobotMotionCommand[] = [];
  const clampedProgress = clamp01(options.scrollProgress);

  for (const scene of scenes) {
    const { start, end } = scene;
    if (clampedProgress < start) continue;
    const range = Math.max(1e-4, end - start);
    const raw = (clampedProgress - start) / range;
    if (!scene.holdAtEnd && clampedProgress > end) continue;
    const t = clamp01(raw);
    const eased = scene.ease ? scene.ease(t) : t;
    const sceneCommands =
      typeof scene.commands === 'function'
        ? scene.commands(eased, options.timeSeconds)
        : scene.commands;

    for (const cmd of sceneCommands) {
      const weight = (cmd.weight ?? 1) * eased;
      commands.push({ ...cmd, weight });
    }
  }

  return commands;
}
