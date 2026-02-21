export const siteResources = {
  models: [
    {
      type: 'Robot',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      anchorKeys: ['head', 'chest'],
    },
  ],
  containedModels: [],
  animations: [
    {
      type: 'ChatRelaxF',
      path: '/assets/motion/chat-relax-f.glb',
    },
  ],
} as const;
