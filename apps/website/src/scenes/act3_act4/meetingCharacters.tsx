import type { JSX } from 'react';
import { Animation, BodyPart, BodyParts, Model, Playback, Pose } from '@brewsite/model';
import { isMobile } from '../../utils/viewport';

interface BodyPartProp {
  id: string;
  targetKind: 'bone' | 'mesh';
  properties: Record<string, unknown>;
}

interface ActorDefn {
  type: string;
  gender: 'female' | 'male';
  id?: string;
  footRotation?: number;
  extraBodyPartProps?: BodyPartProp[];
}

interface ActorProps {
  idBase: string;
  type: string;
  x: number;
  y: number;
  z: number;
  h: number;
  yRotation: number;
  distance: number;
  animationBase: [string, number];
  clipStartOnce: number;
  raiseFoot?: number;
  extraBodyPartProps?: BodyPartProp[];
  facing: 'left' | 'right';
}

const ACTOR_W = 0.08;

const Actor = ({
  idBase, type, x, y, z, h, distance, animationBase, clipStartOnce,
  yRotation, facing, raiseFoot, extraBodyPartProps,
}: ActorProps) => {
  // Pair member positions: offset each actor from the pair center along the pair axis
  const halfDistance = distance / 2;
  const dirX = Math.cos(yRotation);
  const pairYaw = Math.atan2(Math.cos(yRotation), Math.sin(yRotation));

  let actorX: number, yRot: number;
  if (facing === 'left') {
    actorX = x - dirX * halfDistance;
    yRot = pairYaw;
  } else {
    actorX = x + dirX * halfDistance;
    yRot = pairYaw + Math.PI;
  }

  return (
    <Model
      type={type}
      id={idBase}
      x={actorX}
      y={y}
      w={ACTOR_W}
      h={h}
      z={z}
      scale={0.001}
      rotation={[0, yRot + animationBase[1], 0]}
      metalnessMultiplier={0.4}
      roughnessMultiplier={2}
    >
      <BodyParts>
        {raiseFoot && (
          <>
            <BodyPart id="CC_Base_R_Foot" targetKind="bone">
              <Pose rotate={{ pitchPct: raiseFoot }} />
            </BodyPart>
            <BodyPart id="CC_Base_L_Foot" targetKind="bone">
              <Pose rotate={{ pitchPct: raiseFoot }} />
            </BodyPart>
          </>
        )}
        {extraBodyPartProps?.map((prop) => (
          <BodyPart key={prop.id} id={prop.id} targetKind={prop.targetKind} {...prop.properties} />
        ))}
      </BodyParts>
      <Playback>
        <Animation
          clipStartOnce={clipStartOnce}
          clipName={animationBase[0]}
          enabled
          weight={1}
          clipStart={0.2}
          clipEnd={-0.4}
        />
      </Playback>
    </Model>
  );
};

// ── Animation pools ───────────────────────────────────────────────────────────
const F_MOTIONS: [string, number][] = [
  ['chat-talkandlaugh-f', 0.0],
];

const M_MOTIONS: [string, number][] = [
  ['chat-talkandlaugh-m', 0.0],
];

const ACTOR_POOL: ActorDefn[] = [
  { type: 'MaleDummy', gender: 'male' },
];

// ── Deterministic pseudo-random seeding ──────────────────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const rng = seededRng(42);

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + rng() * (max - min);
}

// ── NVS placement helpers ─────────────────────────────────────────────────────
// Characters closer to camera (z near 0) sit near the bottom (y ≈ 0.88).
// Characters farther back (z near -4) sit higher up (y ≈ 0.55), simulating perspective.
function nvsYFromZ(z: number): number {
  return 0.88 + (z / 4) * 0.33;
}

// Near characters are taller (h ≈ 0.35), far characters smaller (h ≈ 0.20).
function nvsHFromZ(z: number): number {
  return 0.35 + (z / 4) * 0.15;
}

// ── Pair layout ───────────────────────────────────────────────────────────────
// Pairs are placed in (NVS x, world z) space.
// x: NVS [0..1] horizontal position of pair center
// z: world-space Z depth, negative = farther from camera
const PAIR_COUNT = isMobile ? 4 : 10;
const PAIR_DISTANCE = 0.05; // distance between pair members in NVS x units

// Minimum x separation between pair centers to avoid overlap
const PAIR_MIN_SEP_X = 0.18;
// Minimum z separation (world units)
const PAIR_MIN_SEP_Z = 0.8;

function generatePairPositions(
  count: number,
): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = [];
  const attempts = count * 40;
  for (let i = 0; i < attempts && positions.length < count; i++) {
    const candidate = {
      x: randomBetween(0.08, 0.92),
      z: randomBetween(-4, 0),
    };
    const isClear = positions.every(({ x, z }) => {
      const dx = Math.abs(candidate.x - x);
      const dz = Math.abs(candidate.z - z);
      return dx >= PAIR_MIN_SEP_X || dz >= PAIR_MIN_SEP_Z;
    });
    if (isClear) positions.push(candidate);
  }
  return positions;
}

// ── Build actors once (compile-time) ─────────────────────────────────────────
const pairPositions = generatePairPositions(PAIR_COUNT);
const actorProps = pairPositions.flatMap((pos, index) => {
  const leftActor = randomChoice(ACTOR_POOL);
  const rightActor = randomChoice(ACTOR_POOL);
  const yRotation = randomBetween(-Math.PI / 2, Math.PI / 2);

  const makeProps = (actor: ActorDefn, facing: 'left' | 'right'): ActorProps => ({
    idBase: `${actor.id ?? actor.type}-pair-${index}-${facing}`,
    type: actor.type,
    x: pos.x,
    y: nvsYFromZ(pos.z),
    z: pos.z,
    h: nvsHFromZ(pos.z),
    distance: randomBetween(PAIR_DISTANCE - 0.01, PAIR_DISTANCE + 0.01),
    yRotation,
    animationBase: actor.gender === 'female'
      ? randomChoice<[string, number]>(F_MOTIONS)
      : randomChoice<[string, number]>(M_MOTIONS),
    clipStartOnce: randomBetween(0, 10),
    facing,
    raiseFoot: actor.footRotation,
    extraBodyPartProps: actor.extraBodyPartProps,
  });

  return [makeProps(leftActor, 'left'), makeProps(rightActor, 'right')];
});

export const actorElements: JSX.Element[] = actorProps.map((actor) => (
  <Actor key={actor.idBase} {...actor} />
));
