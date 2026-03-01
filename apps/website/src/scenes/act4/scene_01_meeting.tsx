import type { JSX } from 'react';
import { Ambient, Camera, Directional, Lighting, ProgressManager, Scene } from '@brewsite/core';
import { Animation, BodyPart, BodyParts, ModelRouter, Playback, Pose } from '@brewsite/model';
import { MidFade } from '@brewsite/core/hud/animejs';
import { isMobile } from '../../utils/viewport';
import type { Vec3 } from '@brewsite/core';

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

// ── Animation pools ──────────────────────────────────────────────────────────
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
const PAIR_COUNT = isMobile ? 4 : 15;
const PAIR_DISTANCE = 4;
const PAIR_SPREAD_X = 48;
const PAIR_SPREAD_Z = 38;
const PAIR_MIN_SEPARATION = 10;

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
    distance: randomBetween(PAIR_DISTANCE - 4, PAIR_DISTANCE + 2),
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

// ── Scene ─────────────────────────────────────────────────────────────────────
export const scene01Meeting: JSX.Element = (
  <Scene id="website-meeting-01">
    <ProgressManager
      scrollUnits={2000}
      autoAdvance={{ duration: 8, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />
    <Camera
      mode="world"
      position={(isMobile ? [0, 22, 70] : [0, 34, 110]) as Vec3}
      target={[0, 0, 0]}
      fov={isMobile ? 60 : 48}
    />

    <Lighting intensityScale={1}>
      <Ambient intensity={0.5} color="#e6eeff" />
      <Directional intensity={0.7} color="#ffffff" position={[0, 20, 20]} />
      <Directional intensity={0.25} color="#aaccff" position={[-10, 8, 5]} />
    </Lighting>
    <div style={{
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: '28%',
      padding: '20px 40px',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(4,8,18,0.2) 0%, rgba(4,8,18,0.95) 100%)',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: 560 }}>
        <MidFade duration={1400}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(0,245,255,0.6)',
            marginBottom: 10,
          }}>
            Procedural Composition
          </div>
          <div style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 700, color: '#f0f6fc', marginBottom: 10 }}>
            30 characters. 50 lines of JSX.
          </div>
          <div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
            Random placement, collision detection, animation assignment — all at
            author time. Runtime is just playback.
          </div>
        </MidFade>
      </div>
    </div>
    {actorProps.map((actor) => (
      <Actor key={actor.idBase} {...actor} />
    ))}
  </Scene>
);
