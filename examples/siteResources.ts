export const siteResources = {
  models: [
    {
      type: 'Robot',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      anchorKeys: ['Head', 'chest'],
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: -130,
      containedModels: [
        {
          type: 'brain',
          target: 'Head',
          scale: 0.53,
          position: [0, -0.03, 0.12],
          rotation: [-0.3, 0, 0],
        },
      ],
    },
    {
      type: 'Worker',
      role: 'primary' as const,
      path: '/assets/uniform-m-0021.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .04,
    },
    {
      type: 'brain',
      role: 'attachment' as const,
      path: '/assets/brain_separated.glb',
    },
  ],
  animations: [
    {
      type: 'ChatRelaxF',
      path: '/assets/motion/chat-relax-f.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'ChatRelaxM',
      path: '/assets/motion/chat-relax-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'ChatTalkAndLaughF',
      path: '/assets/motion/chat-talkandlaugh-f.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'ChatTalkAndLaughM',
      path: '/assets/motion/chat-talkandlaugh-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'DrunkenFall',
      path: '/assets/motion/DrunkenFall/08-drunken-stumble-and-fall.glb',
      clipStart: 0.1,
    },
    {
      type: 'TripForward',
      path: '/assets/motion/TripForward/04-trip-forward-and-roll.glb',
      clipStart: 0.1,
    },
  ],
} as const;
