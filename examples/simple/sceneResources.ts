export const sceneResources = {
  models: [
    {
      id: 'primary',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      anchorKeys: ['head', 'chest'],
    },
  ],
  containedModels: [],
  animations: [
    {
      id: 'chat-relax-f',
      path: '/assets/motion/chat-relax-f.glb',
    },
  ],
} as const;
