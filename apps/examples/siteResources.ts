export const siteResources = {
  models: [
    {
      type: 'Robot',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      scale: 0.18,
      anchorKeys: ['Head', 'chest'],
      // Base rotation applied to the model identity (radians).
      baseRotation: [0, -Math.PI/2, 0],
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
      scale: 30
    },
    {
      type: 'FemaleDummy',
      role: 'primary' as const,
      path: '/assets/motion-dummy_female.no-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'MaleDummy',
      role: 'primary' as const,
      path: '/assets/motion-dummy_male.no-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0057',
      role: 'primary' as const,
      path: '/assets/business-f-0057.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0060',
      role: 'primary' as const,
      path: '/assets/business-f-0060.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0061',
      role: 'primary' as const,
      path: '/assets/business-f-0061.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0062',
      role: 'primary' as const,
      path: '/assets/business-f-0062.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0063',
      role: 'primary' as const,
      path: '/assets/business-f-0063.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0064',
      role: 'primary' as const,
      path: '/assets/business-f-0064.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0065',
      role: 'primary' as const,
      path: '/assets/business-f-0065.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessF0066',
      role: 'primary' as const,
      path: '/assets/business-f-0066.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0079',
      role: 'primary' as const,
      path: '/assets/business-m-0079.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0080',
      role: 'primary' as const,
      path: '/assets/business-m-0080.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0081',
      role: 'primary' as const,
      path: '/assets/business-m-0081.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0082',
      role: 'primary' as const,
      path: '/assets/business-m-0082.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0083',
      role: 'primary' as const,
      path: '/assets/business-m-0083.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0084',
      role: 'primary' as const,
      path: '/assets/business-m-0084.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0085',
      role: 'primary' as const,
      path: '/assets/business-m-0085.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
    },
    {
      type: 'businessM0086',
      role: 'primary' as const,
      path: '/assets/business-m-0086.with-normals.glb',
      // Delta applied on top of computed foot offset (model units, scale=1).
      footOffsetY: .06,
      scale: 30
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
      type: 'ChatListenF',
      path: '/assets/motion/chat-listen-f.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'ChatResponseF',
      path: '/assets/motion/chat-response-f.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'DiscussQueryM',
      path: '/assets/motion/discuss-query-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'DiscussRespondF',
      path: '/assets/motion/discuss-respond-f.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'DiscussWhisperM',
      path: '/assets/motion/discuss-whisper-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'StandingChatM',
      path: '/assets/motion/standing_chat_m_270753.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'StandingDiscussM',
      path: '/assets/motion/standing_discuss_m_270744.glb',
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
