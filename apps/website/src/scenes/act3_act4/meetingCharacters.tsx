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
  yRotation: number;
  distance: number;
  animationBase: [string, number];
  clipStartOnce: number;
  raiseFoot?: number;
  extraBodyPartProps?: BodyPartProp[];
  facing: 'left' | 'right';
}

const Actor = ({
  idBase, type, x, y, distance, animationBase, clipStartOnce,
  yRotation, facing, raiseFoot, extraBodyPartProps,
}: ActorProps) => {
  // Compute NVS offset for each member of the pair
  // distance is in NVS units (small fraction of viewport)
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
      w={0.08}
      h={0.15}
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
  // ['chat-listen-f', 0.0],
  // ['chat-relax-f', 0.0],
  ['chat-talkandlaugh-f', 0.0],
  // ['chat-response-f', 0.0],
  // ['discuss-respond-f', 0.0],
];

const M_MOTIONS: [string, number][] = [
  // ['chat-relax-m', 0.0],
  ['chat-talkandlaugh-m', 0.0],
  // ['discuss-query-m', 0.0],
  // ['discuss-whisper-m', 0.0],
  // ['standing_chat_m_270753', -Math.PI / 3],
  // ['standing_discuss_m_270744', 0.0],
];

const ACTOR_POOL: ActorDefn[] = [
  // {type: 'FemaleDummy', gender: 'female'},
  // { type: 'businessF0057', gender: 'female', footRotation: -0.5 },
  // { type: 'businessF0060', gender: 'female' },
  // { type: 'businessF0061', gender: 'female', footRotation: -0.5 },
  // { type: 'businessF0062', gender: 'female', footRotation: -0.5 },
  // { type: 'businessF0063', gender: 'female', footRotation: -0.5 },
  // { type: 'businessF0064', gender: 'female', footRotation: -0.5 },
  // { type: 'businessF0065', gender: 'female' },
  { type: 'MaleDummy', gender: 'male' },
  // { type: 'businessM0079', gender: 'male' },
  // { type: 'businessM0080', gender: 'male' },
  // { type: 'businessM0081', gender: 'male' },
  // { type: 'businessM0082', gender: 'male' },
  // { type: 'businessM0083', gender: 'male' },
  // { type: 'businessM0084', gender: 'male' },
  // { type: 'businessM0085', gender: 'male' },
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

// ── Pair layout ───────────────────────────────────────────────────────────────
// NVS: x in [0..1] (left to right), y in [0..1] (top to bottom)
const PAIR_COUNT = isMobile ? 4 : 10;
// distance between pair members in NVS units
const PAIR_DISTANCE = 0.05;
// spread across NVS viewport
const PAIR_SPREAD_X = 0.8;
const PAIR_SPREAD_Y = 0.6;
// minimum separation between pair centers in NVS units
const PAIR_MIN_SEPARATION = 0.22;

function generatePairCenters(count: number): Array<{ x: number; y: number }> {
  const centers: Array<{ x: number; y: number }> = [];
  const attempts = count * 30;
  for (let i = 0; i < attempts && centers.length < count; i++) {
    const candidate = {
      x: randomBetween(0.1 + (1 - PAIR_SPREAD_X) / 2, 0.9 - (1 - PAIR_SPREAD_X) / 2),
      y: randomBetween(0.3, 0.3 + PAIR_SPREAD_Y),
    };
    const isClear = centers.every(({ x, y }) => {
      const dx = candidate.x - x;
      const dy = candidate.y - y;
      return Math.hypot(dx, dy) >= PAIR_MIN_SEPARATION;
    });
    if (isClear) centers.push(candidate);
  }
  return centers;
}

// ── Build actors once (compile-time) ─────────────────────────────────────────
const pairCenters = generatePairCenters(PAIR_COUNT);
const actorProps = pairCenters.flatMap((center, index) => {
  const leftActor = randomChoice(ACTOR_POOL);
  const rightActor = randomChoice(ACTOR_POOL);
  const yRotation = randomBetween(-Math.PI / 2, Math.PI / 2);

  const makeProps = (actor: ActorDefn, facing: 'left' | 'right'): ActorProps => ({
    idBase: `${actor.id ?? actor.type}-pair-${index}-${facing}`,
    type: actor.type,
    x: center.x,
    y: center.y,
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
