import type { JSX } from 'react';
import { Fragment } from 'react';
import { sceneOverview } from './scenes/scene_overview';
import { sceneClient } from './scenes/scene_client';
import { sceneFwCloud } from './scenes/scene_fwcloud';
import { sceneProxy } from './scenes/scene_proxy';
import { sceneAlb } from './scenes/scene_alb';
import { sceneControlPlane } from './scenes/scene_controlplane';
import { sceneParkingLot } from './scenes/scene_parkinglot';

export const whiteboardArchScenes: JSX.Element[] = [
  <Fragment key="whiteboard-overview">{sceneOverview}</Fragment>,
  <Fragment key="whiteboard-client">{sceneClient}</Fragment>,
  <Fragment key="whiteboard-fwcloud">{sceneFwCloud}</Fragment>,
  <Fragment key="whiteboard-proxy">{sceneProxy}</Fragment>,
  <Fragment key="whiteboard-alb">{sceneAlb}</Fragment>,
  <Fragment key="whiteboard-controlplane">{sceneControlPlane}</Fragment>,
  <Fragment key="whiteboard-parkinglot">{sceneParkingLot}</Fragment>,
];
