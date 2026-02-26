import {Camera, Floor, FloorMirror, SceneDefinition} from '@brewsite/core';
import { Ambient, Directional, Lighting, Scene } from '@brewsite/core';
import { Diagram, DiagramEdge, DiagramNode, ImagePanel, Screen } from '@brewsite/diagram';

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
      <Diagram id="system-arch" layout="manual">
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

      <ImagePanel
        id="api-docs-screenshot"
        src="/screenshots/api-docs.png"
        position={[5, -4, 12]}
        rotation={[0, -0.2, 0]}
        width={18}
        bezel="dark"
        gloss={0.6}
        selfIllumination={0.2}
        glow
        glowColor="#4488ff"
      />

      <Screen
        id="api-explorer-live"
        src="http://localhost:5173/simple"
        position={[5, -9, 14]}
        rotation={[0, 0, 0]}
        width={30}
        height={6.25}
        bezel="chrome"
        glow
        glowColor="#6699ff"
        opacity={1}
      />
      <Floor enabled position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={0.3}
          mirrorResolution={1024}
          mirrorClipBias={0.003}
          mirrorEnvironmentIntensity={.7}
          mirrorUseEnvironmentBackground
        />
      </Floor>
    </Scene>
  ),
};
