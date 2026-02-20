type ModelRole = 'primary' | 'brain' | 'attachment' | 'unknown';

type ModelDefinitionInput = {
  id: string;
  path: string;
  role: ModelRole;
  parts?: Record<string, {
    id: string;
    anchor: string;
    modelId?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
  }>;
};

type AnimationDefinitionInput = {
  id: string;
  path: string;
  clipName?: string;
};

const Resources = (children: unknown) => children;
const ModelDefinition = (input: ModelDefinitionInput) => input;
const AnimationDefinition = (input: AnimationDefinitionInput) => input;

export const sceneResources = Resources([
  ModelDefinition({
    id: 'robot',
    path: 'robot.no-normals.glb',
    role: 'primary',
  }),
  AnimationDefinition({
    id: 'chat-relax-f',
    path: 'ChatRelaxF/chat-relax-f.glb',
  }),
]);
