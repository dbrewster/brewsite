export const siteResources = {
  models: [
    {
      type: 'MaleDummy',
      role: 'primary' as const,
      path: '/assets/motion-dummy_male.no-normals.glb',
      footOffsetY: 0.06,
      scale: 30,
    },
  ],
  animations: [
    {
      type: 'ChatRelaxM',
      path: '/assets/motion/chat-relax-m.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
    {
      type: 'StandingChatM',
      path: '/assets/motion/standing_chat_m_270753.glb',
      clipStart: 0.1,
      clipEnd: -0.8,
    },
  ],
};
