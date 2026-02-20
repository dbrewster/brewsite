import type {RestBoneSpec} from '../../components/logoParticleOptimizedViewer/robotRig';

const TWO_PI = Math.PI * 2;

export type RestDelta = {
  rotX: number;
  rotY: number;
  rotZ: number;
  posX?: number;
  posY?: number;
  posZ?: number;
};

export const computeRestDelta = (
  spec: RestBoneSpec,
  timeSeconds: number,
  intensity: number,
  speed: number,
): RestDelta => {
  const periodSeconds = 6;
  const w = TWO_PI / periodSeconds;
  const timePhase = timeSeconds * w * speed;
  const phase = (spec.phase ?? 0) + timePhase;
  const breath = Math.sin(phase);
  const sway = Math.sin(phase + Math.PI / 2);
  return {
    rotX: breath * spec.rotX * intensity,
    rotY: sway * spec.rotY * intensity,
    rotZ: sway * spec.rotZ * intensity,
    posX: (spec.posX ?? 0) * sway * intensity,
    posY: (spec.posY ?? 0) * breath * intensity,
    posZ: (spec.posZ ?? 0) * sway * intensity,
  };
};

export type BlinkState = {
  scaleY: number;
  yOffsetFactor: number;
};

export const computeBlinkState = (timeSeconds: number): BlinkState => {
  const blinkInterval = 5.2;
  const blinkDuration = 0.32;
  const blinkGap = 0.12;
  const blinkPhase = timeSeconds % blinkInterval;
  let blinkAmount = 0;
  const isDoubleBlink = Math.floor(timeSeconds / blinkInterval) % 4 === 0;
  const totalDouble = blinkDuration * 2 + blinkGap;
  const blinkPulse = (t: number) => (t < 0.5 ? t * 2 : (1 - t) * 2);
  if (isDoubleBlink) {
    if (blinkPhase < blinkDuration) {
      blinkAmount = blinkPulse(blinkPhase / blinkDuration);
    } else if (blinkPhase < totalDouble && blinkPhase > blinkDuration + blinkGap) {
      const t = (blinkPhase - blinkDuration - blinkGap) / blinkDuration;
      blinkAmount = blinkPulse(t);
    }
  } else if (blinkPhase < blinkDuration) {
    blinkAmount = blinkPulse(blinkPhase / blinkDuration);
  }
  const baseLid = 0.32;
  const scaleY = 1 - (baseLid + blinkAmount * 0.85);
  const yOffsetFactor = (1 - scaleY) * 0.5;
  return { scaleY, yOffsetFactor };
};
