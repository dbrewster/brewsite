import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Directional, Lighting, Scene } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramGroup, DiagramNode, Exit } from '@brewsite/diagram';

export const sceneArchOverview: SceneDefinition = {
  id: 'arch-overview',
  index: 0,
  getFrame: () => (
    <Scene id="arch-overview">
      <Lighting intensityScale={1}>
        <Ambient intensity={1.2} color="#ffffff" />
        <Directional intensity={2.5} color="#ffffff" position={[20, 30, 50]} />
        <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
      </Lighting>
      <DiagramCanvas id="system-canvas" rotation={[-Math.PI/4, 0, 0]}>
        <Diagram id="system-arch" layout="manual" pivot="center">
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
              clickable
            />
            <DiagramNode
              id="alb"
              label="Load Balancer"
              shape="aws:alb"
              position={[0, -1, 0]}
              clickable
            />
            <DiagramNode
              id="api"
              label="API Gateway"
              shape="aws:api-gateway"
              position={[0, -4, 0]}
              clickable
            />
          </DiagramGroup>

          <DiagramGroup id="compute" label="Compute Tier" variant="boundary">
            <DiagramNode id="ecs" label="ECS Cluster" shape="aws:ecs" position={[-5, -8, 0]} clickable />
            <DiagramNode id="lambda" label="Lambda" shape="aws:lambda" position={[5, -8, 0]} clickable />
          </DiagramGroup>

          <DiagramGroup id="data" label="Data Tier" variant="swimlane">
            <DiagramNode id="rds" label="RDS PostgreSQL" shape="aws:rds" position={[-5, -13, 0]} />
            <DiagramNode id="cache" label="ElastiCache" shape="aws:elasticache" position={[0, -13, 0]} />
            <DiagramNode id="s3" label="S3 Assets" shape="aws:s3" position={[5, -13, 0]} />
          </DiagramGroup>

          <DiagramEdge from="browser" to="cdn" label="HTTPS" />
          <DiagramEdge from="cdn" to="alb" />
          <DiagramEdge from="alb" to="api" />
          <DiagramEdge from="api" to="ecs" label="REST" />
          <DiagramEdge from="api" to="lambda" label="Events" style="dashed" />
          <DiagramEdge from="ecs" to="rds" label="TCP 5432" />
          <DiagramEdge from="ecs" to="cache" label="Redis" />
          <DiagramEdge from="ecs" to="s3" label="r/w" style="dashed" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
