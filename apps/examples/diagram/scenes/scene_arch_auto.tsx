import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Directional, Lighting, Scene } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramNode } from '@brewsite/diagram';

/**
 * Auto-layout demo: the same AWS architecture as scene_arch_overview but with
 * NO explicit node positions.  The hierarchical layout engine computes placement
 * from the edge topology (topological sort → depth levels → centred rows).
 *
 * Nodes inside groups are also auto-laid-out: the group handler collects their
 * IDs and compile.ts places them via resolveLayout before computing group bounds.
 */
export const sceneArchAuto: SceneDefinition = {
  id: 'arch-auto',
  index: 0,
  getFrame: () => (
    <Scene id="arch-auto">
      <Lighting intensityScale={1}>
        <Ambient intensity={1.2} color="#ffffff" />
        <Directional intensity={2.5} color="#ffffff" position={[20, 30, 50]} />
        <Directional intensity={0.6} color="#aaccff" position={[-20, 10, 20]} />
      </Lighting>

      <DiagramCanvas id="auto-canvas" rotation={[-Math.PI / 4, 0, 0]}>
        {/*
          layout="hierarchical" + layoutSpacing=[3, 2]:
            horizontal gap = 3 diagram units between nodes in the same row
            vertical gap   = 2 diagram units between hierarchy levels

          No positions on DiagramNode → all positions computed from edges.
        */}
        <Diagram id="arch-auto" layout="hierarchical" layoutSpacing={[3, 2]} pivot="center">

          {/* ── Tier 1: Client ────────────────────────────────────────── */}
          <DiagramNode id="browser" label="Web Browser" shape="flow:actor" />

          {/* ── Tier 2: CDN / Load Balancing ──────────────────────────── */}
          <DiagramNode id="cdn"    label="CloudFront CDN"  shape="aws:cloudfront"  clickable metalness={.9} iconStyle={'embossed'} iconDepth={.5} enabled/>
          <DiagramNode id="alb"    label="Load Balancer"   shape="aws:alb"         clickable />

          {/* ── Tier 3: API ───────────────────────────────────────────── */}
          <DiagramNode id="api"    label="API Gateway"     shape="aws:api-gateway" clickable />

          {/* ── Tier 4: Compute ───────────────────────────────────────── */}
          <DiagramNode id="ecs"    label="ECS Cluster"     shape="aws:ecs"         clickable metalness={.9} iconStyle={'extruded'} />
          <DiagramNode id="lambda" label="Lambda"          shape="aws:lambda"      clickable color="#2a2d4e" />

          {/* ── Tier 5: Data ──────────────────────────────────────────── */}
          <DiagramNode id="rds"    label="RDS PostgreSQL"  shape="aws:rds" />
          <DiagramNode id="cache"  label="ElastiCache"     shape="aws:elasticache" />
          <DiagramNode id="s3"     label="S3 Assets"       shape="aws:s3" />

          {/* ── Edges (define the hierarchy that drives layout) ────────── */}
          <DiagramEdge from="browser" to="cdn"    label="HTTPS" />
          <DiagramEdge from="cdn"     to="alb" />
          <DiagramEdge from="alb"     to="api" />
          <DiagramEdge from="api"     to="ecs"    label="REST" />
          <DiagramEdge from="api"     to="lambda" label="Events" style="dashed" color="#7788bb" />
          <DiagramEdge from="ecs"     to="rds"    label="TCP 5432" />
          <DiagramEdge from="ecs"     to="cache"  label="Redis" />
          <DiagramEdge from="ecs"     to="s3"     label="r/w"    style="dashed" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
