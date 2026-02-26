import {Camera, Floor, FloorMirror, SceneDefinition} from '@brewsite/core';
import { Ambient, Directional, Lighting, Scene } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramNode, Enter, ImagePanel, Screen } from '@brewsite/diagram';

export const sceneArchEcsDetail: SceneDefinition = {
  id: 'arch-ecs-detail',
  index: 1,
  getFrame: () => (
    <Scene id="arch-ecs-detail">
      <Camera
        enabled
        mode="fitFloorDepth"
        fov={60}
        floorY={0}
        floorZMin={-250}
        floorZMax={100}
        cameraY={40}
        lookAtZ={-20}
      />
      <Lighting intensityScale={1}>
        <Ambient intensity={1.0} color="#ffffff" />
        <Directional intensity={2.5} color="#ffffff" position={[20, 30, 50]} />
        <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
      </Lighting>
      <DiagramCanvas id="system-canvas" rotation={[-Math.PI/4, 0, 0]}>
        <Diagram id="system-arch" layout="manual" pivot="center">
          <Enter from={[-60, 0, 0]} fade easing="ease-in" />
          <DiagramNode id="cdn" position={[0, 2, -25]} opacity={0.3} />
          <DiagramNode id="alb" position={[0, -1, -25]} opacity={0.3} />
          <DiagramNode id="api" position={[0, -4, -25]} opacity={0.3} />
          <DiagramNode id="lambda" position={[5, -8, -25]} opacity={0.3} />
          <DiagramNode id="rds" position={[-5, -13, -25]} opacity={0.3} />
          <DiagramNode id="cache" position={[0, -13, -25]} opacity={0.3} />
          <DiagramNode id="s3" position={[5, -13, -25]} opacity={0.3} />

          <DiagramNode
            id="ecs"
            label="ECS Cluster"
            shape="aws:ecs"
            position={[-5, -8, -5]}
            depth={0.8}
            color="#1a3d5c"
            size={[6, 3]}
          />

          <DiagramNode
            id="svc-auth"
            label="Auth Service"
            shape="flow:rounded"
            position={[-9, -6, 8]}
            color="#0d3d2b"
            size={[4, 2]}
          />
          <DiagramNode
            id="svc-api"
            label="API Service"
            shape="flow:rounded"
            position={[-5, -6, 8]}
            color="#0d3d2b"
            size={[4, 2]}
          />
          <DiagramNode
            id="svc-worker"
            label="Worker"
            shape="flow:rounded"
            position={[-1, -6, 8]}
            color="#0d3d2b"
            size={[4, 2]}
          />

          <DiagramEdge from="ecs" to="svc-auth" />
          <DiagramEdge from="ecs" to="svc-api" />
          <DiagramEdge from="ecs" to="svc-worker" />
          <DiagramEdge from="svc-api" to="rds" />
          <DiagramEdge from="svc-auth" to="cache" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
