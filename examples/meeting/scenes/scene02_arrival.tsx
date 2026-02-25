import {Ambient, Background, BodyPart, Directional, Lighting, ModelRouter, Scene, SceneDefinition} from '@brewsite/core';
import {Animation, BodyParts, Playback, Pose} from '../../generated/sceneDsl.generated';
import {backgrounds, sceneLighting} from './sceneAssets';

export interface ActorProps {
  idBase: string,
  type: string,
  xPosition: number,
  zPosition: number,
  distance: number,
  animationBase: string,
  clipStartOnce: number,
  raiseFoot?: number,
  facing: 'left' | 'right'
}

export const Actor = ({
                                 idBase, type,
                                 zPosition, xPosition, distance, animationBase, clipStartOnce,
                                 facing,
                                 raiseFoot
                               }: ActorProps) => {
  let xPos, zPos, yRot
  if (facing === 'left') {
    xPos = xPosition - distance / 2
    zPos = zPosition
    yRot = Math.PI / 2
  } else {
    xPos = xPosition + distance / 2
    zPos = zPosition
    yRot = -Math.PI / 2
  }
  return (
    <ModelRouter
      type={type}
      id={idBase}
      position={[xPos, 0, zPos]}
      rotation={[0, yRot, 0]}
      scale={30}
    >
      <BodyParts>
        {raiseFoot && (
          <>
            <BodyPart id={'CC_Base_R_Foot'} targetKind='bone'>
              <Pose rotate={{pitchPct: raiseFoot}}/>
            </BodyPart>
            <BodyPart id={'CC_Base_L_Foot'} targetKind='bone'>
              <Pose rotate={{pitchPct: raiseFoot}}/>
            </BodyPart>
          </>
        )}
      </BodyParts>
      <Playback>
        <Animation clipStartOnce={clipStartOnce} clipName={animationBase} enabled weight={1} clipStart={.1}/>
      </Playback>
    </ModelRouter>
  )
}

const f_motions = [
  'chat-listen-f',
  'chat-relax-f',
  'chat-talkandlaugh-f',
  'chat-response-f',
  'discuss-respond-f',
]

const m_motions = [
  'chat-relax-m',
  'chat-talkandlaugh-m',
  'discuss-query-m',
  'discuss-whisper-m',
  'standing_chat_m_270753',
  'standing_discuss_m_270744',
]

const f_actors = [
  'businessF0057',
  'businessF0061',
  'businessF0062',
  'businessF0065',
  'FemaleDummy',
 ] as const;

const m_actors = [
  'businessM0079',
  'businessM0081',
  'businessM0084',
  'businessM0085',
  'MaleDummy',
] as const;

type ActorGender = 'female' | 'male';
type ActorEntry = {type: string; gender: ActorGender};

const actorPool: ActorEntry[] = [
  ...f_actors.map((type) => ({type, gender: 'female' as const})),
  ...m_actors.map((type) => ({type, gender: 'male' as const})),
];

const PAIR_COUNT = 5;
const PAIR_DISTANCE = 26;
const PAIR_MIN_SEPARATION = PAIR_DISTANCE * 2;
const PAIR_X_RANGE: [number, number] = [-60, 60];
const PAIR_Z_RANGE: [number, number] = [-180, -60];
const MAX_PLACEMENT_ATTEMPTS = 5000;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomChoice = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

const shuffled = <T,>(items: readonly T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const generatePairCenters = (count: number) => {
  const centers: {x: number; z: number}[] = [];
  let attempts = 0;
  while (centers.length < count && attempts < MAX_PLACEMENT_ATTEMPTS) {
    attempts += 1;
    const candidate = {
      x: randomBetween(PAIR_X_RANGE[0], PAIR_X_RANGE[1]),
      z: randomBetween(PAIR_Z_RANGE[0], PAIR_Z_RANGE[1]),
    };
    const isClear = centers.every((center) => {
      const dx = candidate.x - center.x;
      const dz = candidate.z - center.z;
      return Math.hypot(dx, dz) >= PAIR_MIN_SEPARATION;
    });
    if (isClear) centers.push(candidate);
  }
  if (centers.length < count) {
    console.warn(
      `[scene02_arrival] Only placed ${centers.length} of ${count} actor pairs after ${attempts} attempts.`,
    );
  }
  return centers;
};

const buildActorProps = (
  pairIndex: number,
  facing: 'left' | 'right',
  center: {x: number; z: number},
  actor: ActorEntry,
) => {
  const animationBase = actor.gender === 'female'
    ? randomChoice(f_motions)
    : randomChoice(m_motions);
  return {
    idBase: `pair-${pairIndex}-${facing}`,
    type: actor.type,
    xPosition: center.x,
    zPosition: center.z,
    distance: PAIR_DISTANCE,
    animationBase,
    clipStartOnce: randomBetween(0, 10),
    facing,
    raiseFoot: actor.gender === 'female' && actor.type !== 'FemaleDummy' ? -0.5 : undefined,
  } satisfies ActorProps;
};


export const scene02Arrival: SceneDefinition = {
  id: 'complex-arrival',
  index: 1,
  getFrame: () => {
    const pairCenters = generatePairCenters(PAIR_COUNT);
    const availableActors = shuffled(actorPool);
    const actors = pairCenters.flatMap((center, index) => {
      const leftActor = availableActors[index * 2];
      const rightActor = availableActors[index * 2 + 1];
      return [
        buildActorProps(index, 'left', center, leftActor),
        buildActorProps(index, 'right', center, rightActor),
      ];
    });
    return (
      <Scene id="complex-arrival">
        <Background imageUrl={backgrounds.reveal} opacity={1} cssSize="cover" cssPosition="center"/>
        <Lighting intensityScale={1}>
          <Ambient intensity={sceneLighting.soft.ambient} color="#e6eeff"/>
          <Directional intensity={sceneLighting.soft.directional} color="#ffffff" position={sceneLighting.soft.direction}/>
        </Lighting>
        {actors.map((actor) => (
          <Actor key={actor.idBase} {...actor} />
        ))}
      </Scene>
    );
  },
};
