import {Background, Environment, EnvironmentCube, Floor, FloorMirror, SceneDefinition} from '@brewsite/core';
import { Ambient, Camera, Directional, Lighting, Scene } from '@brewsite/core';
import {DiagramCanvas, Diagram, DiagramEdge, DiagramGroup, DiagramNode, Exit, ManualLayout, darkGlassTheme} from '@brewsite/diagram';
import {backgrounds, makeCubeUrls, skyEnvironment} from "./sceneAssets";

export const sceneArchOverview: SceneDefinition = {
  id: 'arch-overview',
  index: 0,
  getFrame: () => (
    <Scene id="arch-overview">
      <Environment enabled intensity={0.05}>
        <EnvironmentCube urls={makeCubeUrls(skyEnvironment)} />
      </Environment>
      <Background imageUrl={backgrounds.intro} opacity={1} cssSize="cover" cssPosition="center" />
      <Floor enabled position={[0, -20, 0]}>
        <FloorMirror
          mirrorColor="#ffe9c4"
          mirrorOpacity={.2}
          mirrorResolution={1024}
          mirrorClipBias={0.003}
          mirrorEnvironmentIntensity={.7}
          mirrorUseEnvironmentBackground
        />
      </Floor>
      <Camera
        mode="world"
        fov={55}
        position={[0, 10, 50]}
        target={[0, 0, 0]}
      />
      <Lighting intensityScale={1}>
        <Ambient intensity={1.2} color="#ffffff" />
        <Directional intensity={.5} color="#ffefef" position={[0, 30, 50]} />
        <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
      </Lighting>
      <DiagramCanvas id="system-canvas" rotation={[-Math.PI / 8, 0, 0]} scale={1.4} theme={darkGlassTheme}>
        <Diagram id="system-arch" pivot="center">
          <ManualLayout />
          <Exit to={[0, -60, 0]} fade easing="ease-out" />
          <DiagramGroup id="frontend" label="Client Tier" variant="swimlane">
            <DiagramNode id="browser" label="Web Browser" shape="flow:actor" position={[-6, 6, 0]} />
          </DiagramGroup>

          <DiagramGroup id="api-tier" label="API Tier" variant="boundary">
            <DiagramNode
              id="cdn"
              label="CloudFront CDN"
              shape="aws:cloudfront"
              position={[0, 2, 0]}
             
            />
            <DiagramNode
              id="alb"
              label="Load Balancer"
              shape="aws:alb"
              position={[0, -1, 0]}
            />
            <DiagramNode
              id="api"
              label="API Gateway"
              shape="aws:api-gateway"
              position={[0, -4, 0]}
            />
          </DiagramGroup>

          <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
            <DiagramNode id="ecs" label="ECS Cluster" shape="aws:ecs" position={[-5, -8, 0]} />
            <DiagramNode id="lambda" label="Lambda" shape="aws:lambda" position={[5, -8, 0]} />
          </DiagramGroup>

          <DiagramGroup id="data" label="Data Tier" variant="swimlane">
            <DiagramNode id="rds" label="RDS PostgreSQL" shape="aws:rds" position={[-5, -13, 0]} />
            <DiagramNode id="cache" label="ElastiCache" shape="aws:elasticache" position={[0, -13, 0]} />
            <DiagramNode id="s3" label="S3 Assets" shape="aws:s3" position={[5, -13, 0]} />
          </DiagramGroup>

          <DiagramEdge from="browser" to="cdn" label="HTTPS" flow="forward" />
          <DiagramEdge from="cdn" to="alb" flow="forward" />
          <DiagramEdge from="alb" to="api" flow="forward" />
          <DiagramEdge from="api" to="ecs" label="REST" flow="forward" />
          <DiagramEdge from="api" to="lambda" label="Events" style="dashed" flow="forward" />
          <DiagramEdge from="ecs" to="rds" label="TCP 5432" flow="forward" />
          <DiagramEdge from="ecs" to="cache" label="Redis" flow="forward" />
          <DiagramEdge from="ecs" to="s3" label="r/w" style="dashed" flow="forward" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
