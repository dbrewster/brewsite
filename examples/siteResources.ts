export const siteResources = {
  models: [
    {
      type: 'Robot',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      anchorKeys: ['Head', 'chest'],
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: -130,
    },
  ],
  containedModels: [
    {
      type: 'brain',
      path: '/assets/brain_separated.glb',
      target: 'Head',
      scale: 0.53,
      position:[0, -0.03, 0.12],
      rotation:[-0.3, 0, 0]
    },
  ],
  animations: [
    {
      type: 'ChatRelaxF',
      path: '/assets/motion/chat-relax-f.glb',
    },
    {
      type: 'ChatRelaxM',
      path: '/assets/motion/chat-relax-m.glb',
    },
    {
      type: 'ChatTalkAndLaughF',
      path: '/assets/motion/chat-talkandlaugh-f.glb',
    },
    {
      type: 'ChatTalkAndLaughM',
      path: '/assets/motion/chat-talkandlaugh-m.glb',
    },
  ],
} as const;
