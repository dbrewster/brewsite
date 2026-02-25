import {Ambient, Background, BodyPart, Directional, Lighting, ModelRouter, Scene, SceneDefinition} from '@brewsite/core';
import {Animation, BodyParts, Playback, Pose} from '@brewsite/core';
import {backgrounds, sceneLighting} from './sceneAssets';

export interface BodyPartProp {
  id: string,
  targetKind: 'bone' | 'mesh',
  properties: { [key: string]: any },
}

export interface ActorProps {
  idBase: string,
  type: string,
  xPosition: number,
  zPosition: number,
  yRotation: number,
  distance: number,
  animationBase: [string, number],
  clipStartOnce: number,
  raiseFoot?: number,
  extraBodyPartProps?: BodyPartProp[],
  facing: 'left' | 'right'
}

export interface ActorDefn {
  type: string,
  gender: 'female' | 'male',
  id?: string,
  footRotation?: number,
  extraBodyPartProps?: BodyPartProp[],
}

export const Actor = ({
                        idBase, type,
                        zPosition, xPosition, distance, animationBase, clipStartOnce,
                        yRotation,
                        facing,
                        raiseFoot,
                        extraBodyPartProps,
                      }: ActorProps) => {
  let xPos, zPos, yRot
  const halfDistance = distance / 2
  const dirX = Math.cos(yRotation)
  const dirZ = Math.sin(yRotation)
  const pairYaw = Math.atan2(dirX, dirZ)
  if (facing === 'left') {
    xPos = xPosition - dirX * halfDistance
    zPos = zPosition - dirZ * halfDistance
    yRot = pairYaw
  } else {
    xPos = xPosition + dirX * halfDistance
    zPos = zPosition + dirZ * halfDistance
    yRot = pairYaw + Math.PI
  }
  return (
    <ModelRouter
      type={type}
      id={idBase}
      position={[xPos, 0, zPos]}
      rotation={[0, yRot + animationBase[1], 0]}
      metalnessMultiplier={.4}
      roughnessMultiplier={2}
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

        {extraBodyPartProps?.map((prop) => (
          <BodyPart key={prop.id} id={prop.id} targetKind={prop.targetKind} {...prop.properties}/>
        ))}
      </BodyParts>
      <Playback>
        <Animation clipStartOnce={clipStartOnce} clipName={animationBase[0]} enabled weight={1} clipStart={.2} clipEnd={-.4}/>
      </Playback>
    </ModelRouter>
  )
}

const f_motions: [string, number][] = [
  ['chat-listen-f', 0.0],
  ['chat-relax-f', 0.0],
  ['chat-talkandlaugh-f', 0.0],
  ['chat-response-f', 0.0],
  ['discuss-respond-f', 0.0],
]

const m_motions: [string, number][] = [
  ['chat-relax-m', 0.0],
  ['chat-talkandlaugh-m', 0.0],
  ['discuss-query-m', 0.0],
  ['discuss-whisper-m', 0.0],
  ['standing_chat_m_270753', -Math.PI / 3],
  ['standing_discuss_m_270744', 0.0],
]

const botColors = [
  '#ffffff',
  '#aaaaaa',
  '#00ff00',
  '#4499cc',
  '#44cccc',
  '#ff00ff',
  '#00ffff',
]

const actorPool: ActorDefn[] = [
  {type: 'businessF0057', gender: 'female', footRotation: -.5},
  {type: 'businessF0060', gender: 'female'},
  {type: 'businessF0061', gender: 'female', footRotation: -.5},
  {type: 'businessF0062', gender: 'female', footRotation: -.5},
  {type: 'businessF0063', gender: 'female', footRotation: -.5},
  {type: 'businessF0064', gender: 'female', footRotation: -.5},
  {type: 'businessF0065', gender: 'female'},
  {type: 'businessF0066', gender: 'female', footRotation: -.5},
  {type: 'businessM0079', gender: 'male'},
  {type: 'businessM0080', gender: 'male'},
  {type: 'businessM0081', gender: 'male'},
  {type: 'businessM0082', gender: 'male'},
  {type: 'businessM0083', gender: 'male'},
  {type: 'businessM0084', gender: 'male'},
  {type: 'businessM0085', gender: 'male'},
  {type: 'businessM0086', gender: 'male'},
  ...botColors.slice(1).flatMap((color, idx) => {
    const baseId = idx * 2 + 3;
    return [
      {type: 'FemaleDummy', id: String(baseId).padStart(2, '0'), gender: 'female', extraBodyPartProps: [{id: 'Motion_Dummy_Female', targetKind: 'mesh', properties: {color}}]},
      {type: 'MaleDummy', id: String(baseId + 1).padStart(2, '0'), gender: 'male', extraBodyPartProps: [{id: 'Motion_Dummy_Male', targetKind: 'mesh', properties: {color}}]},
    ] as ActorDefn[];
  }),
]

const PAIR_COUNT = 15;
const PAIR_DISTANCE = 26;
const PAIR_MIN_SEPARATION = PAIR_DISTANCE * 1.4;
const PAIR_X_RANGE: [number, number] = [-80, 80];
const PAIR_Z_RANGE: [number, number] = [-280, -40];
const MAX_PLACEMENT_ATTEMPTS = 5000;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomChoice = <T, >(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

const shuffled = <T, >(items: readonly T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const generatePairCenters = (count: number) => {
  const centers: { x: number; z: number }[] = [];
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
  center: { x: number; z: number },
  actor: ActorDefn,
  yRotation: number,
) => {
  const animationBase: [string, number] = actor.gender === 'female'
    ? randomChoice<[string, number]>(f_motions)
    : randomChoice<[string, number]>(m_motions);
  return {
    idBase: `${actor.id ?? actor.type}-pair-${pairIndex}-${facing}`,
    type: actor.type,
    xPosition: center.x,
    zPosition: center.z,
    distance: randomBetween(PAIR_DISTANCE - 4, PAIR_DISTANCE + 4),
    yRotation,
    animationBase,
    clipStartOnce: randomBetween(0, 10),
    facing,
    raiseFoot: actor.footRotation,
    extraBodyPartProps: actor.extraBodyPartProps,
  } satisfies ActorProps;
};


export const scene02Arrival: SceneDefinition = {
  id: 'complex-arrival',
  index: 1,
  getFrame: () => {
    const pairCenters = generatePairCenters(PAIR_COUNT);
    const actors = pairCenters.flatMap((center, index) => {
      const leftActor = randomChoice(actorPool);
      const rightActor = randomChoice(actorPool);
      const yRotation = randomBetween(-Math.PI / 2, Math.PI / 2);
      return [
        buildActorProps(index, 'left', center, leftActor, yRotation),
        buildActorProps(index, 'right', center, rightActor, yRotation),
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
