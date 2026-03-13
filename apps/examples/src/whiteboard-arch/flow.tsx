import type { JSX } from 'react';
import { SceneOverview } from './scenes/scene_overview';
import { SceneClient } from './scenes/scene_client';
import { SceneFwCloud } from './scenes/scene_fwcloud';
import { SceneProxy } from './scenes/scene_proxy';
import { SceneAlb } from './scenes/scene_alb';
import { SceneControlPlane } from './scenes/scene_controlplane';
import { SceneParkingLot } from './scenes/scene_parkinglot';

export const whiteboardArchScenes: JSX.Element[] = [
  <SceneOverview key="whiteboard-overview" />,
  <SceneClient key="whiteboard-client" />,
  <SceneFwCloud key="whiteboard-fwcloud" />,
  <SceneProxy key="whiteboard-proxy" />,
  <SceneAlb key="whiteboard-alb" />,
  <SceneControlPlane key="whiteboard-controlplane" />,
  <SceneParkingLot key="whiteboard-parkinglot" />,
];
