import type { JSX } from 'react';
import { Animation, BodyPart, BodyParts, ModelRouter, Playback, Pose } from '@brewsite/model';
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
  xPosition: number;
  zPosition: number;
  yRotation: number;
  distance: number;
  animationBase: [string, number];
  clipStartOnce: number;
  raiseFoot?: number;
  extraBodyPartProps?: BodyPartProp[];
  facing: 'left' | 'right';
}

const Actor = ({
  idBase, type, zPosition, xPosition, distance, animationBase, clipStartOnce,
  yRotation, facing, raiseFoot, extraBodyPartProps,
}: ActorProps) => {
  const halfDistance = distance / 2;
  const dirX = Math.cos(yRotation);
  const dirZ = Math.sin(yRotation);
  const pairYaw = Math.atan2(dirX, dirZ);

  let xPos: number, zPos: number, yRot: number;
  if (facing === 'left') {
    xPos = xPosition - dirX * halfDistance;
    zPos = zPosition - dirZ * halfDistance;
    yRot = pairYaw;
  } else {
    xPos = xPosition + dirX * halfDistance;
    zPos = zPosition + dirZ * halfDistance;
    yRot = pairYaw + Math.PI;
  }

  return (
    <ModelRouter
      type={type}
      id={idBase}
      scale={6}
      position={[xPos, 0, zPos]}
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
    </ModelRouter>
  );
};

// ── Animation pools ───────────────────────────────────────────────────────────
const F_MOTIONS: [string, number][] = [
  ['chat-listen-f', 0.0],
  ['chat-relax-f', 0.0],
  ['chat-talkandlaugh-f', 0.0],
  ['chat-response-f', 0.0],
  ['discuss-respond-f', 0.0],
];

const M_MOTIONS: [string, number][] = [
  ['chat-relax-m', 0.0],
  ['chat-talkandlaugh-m', 0.0],
  ['discuss-query-m', 0.0],
  ['discuss-whisper-m', 0.0],
  ['standing_chat_m_270753', -Math.PI / 3],
  ['standing_discuss_m_270744', 0.0],
];

const ACTOR_POOL: ActorDefn[] = [
  { type: 'businessF0057', gender: 'female', footRotation: -0.5 },
  { type: 'businessF0060', gender: 'female' },
  { type: 'businessF0061', gender: 'female', footRotation: -0.5 },
  { type: 'businessF0062', gender: 'female', footRotation: -0.5 },
  { type: 'businessF0063', gender: 'female', footRotation: -0.5 },
  { type: 'businessF0064', gender: 'female', footRotation: -0.5 },
  { type: 'businessF0065', gender: 'female' },
  { type: 'businessM0079', gender: 'male' },
  { type: 'businessM0080', gender: 'male' },
  { type: 'businessM0081', gender: 'male' },
  { type: 'businessM0082', gender: 'male' },
  { type: 'businessM0083', gender: 'male' },
  { type: 'businessM0084', gender: 'male' },
  { type: 'businessM0085', gender: 'male' },
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
const PAIR_COUNT = isMobile ? 4 : 10;
const PAIR_DISTANCE = 5;
const PAIR_SPREAD_X = 48;
const PAIR_SPREAD_Z = 38;
const PAIR_MIN_SEPARATION = 16;

function generatePairCenters(count: number): Array<{ x: number; z: number }> {
  const centers: Array<{ x: number; z: number }> = [];
  const attempts = count * 30;
  for (let i = 0; i < attempts && centers.length < count; i++) {
    const candidate = {
      x: randomBetween(-PAIR_SPREAD_X / 2, PAIR_SPREAD_X / 2),
      z: randomBetween(-PAIR_SPREAD_Z / 2, PAIR_SPREAD_Z / 2),
    };
    const isClear = centers.every(({ x, z }) => {
      const dx = candidate.x - x;
      const dz = candidate.z - z;
      return Math.hypot(dx, dz) >= PAIR_MIN_SEPARATION;
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
    xPosition: center.x,
    zPosition: center.z,
    distance: randomBetween(PAIR_DISTANCE - 2, PAIR_DISTANCE + 2),
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
