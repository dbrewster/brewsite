import type { SceneDefinition } from '@brewsite/core';
import { Ambient, Directional, Lighting, Scene } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramEdge, DiagramNode, HierarchicalLayout } from '@brewsite/diagram';

/**
 * Auto-layout demo: the same AWS architecture as scene_arch_overview but with
 * NO explicit node positions.  The hierarchical layout engine computes placement
 * from the edge topology (topological sort → depth levels → centred rows).
 *
 * Icons are rendered with 3D extruded geometry (iconStyle + iconDepth) to
 * showcase the SvgIcon3D system. Three modes are on display:
 *   'layered'  — background colour plate + white symbol raised above it
 *   'extruded' — all paths extruded to the same depth, lit by PBR side faces
 *   'embossed' — shallow extrusion with wide bevel, coin/medallion look
 */
export const sceneArchAuto: SceneDefinition = {
  id: 'arch-auto',
  index: 0,
  getFrame: () => (
    <Scene id="arch-auto">
      <Lighting intensityScale={1}>
        {/* Soft ambient so shadows on side faces are still readable */}
        <Ambient intensity={0.8} color="#ffffff" />
        {/* Strong front-top light — makes bevel chamfers sparkle */}
        <Directional intensity={3.0} color="#ffffff"  position={[10, 30, 60]} />
        {/* Left fill — catches the Z-faces of extrusions from the side */}
        <Directional intensity={1.2} color="#c8ddff"  position={[-30, 15, 20]} />
        {/* Warm underfill — separates background slab from foreground symbol in layered mode */}
        <Directional intensity={0.5} color="#ffe0b0"  position={[0, -20, 10]} />
      </Lighting>

      {/*
        30° tilt (PI/6) instead of 45°: nodes face more toward the camera so
        the icon extrusion depth reads clearly without shrinking node faces.
      */}
      <DiagramCanvas id="auto-canvas" rotation={[-Math.PI / 6, 0, 0]}>
        <Diagram id="arch-auto" pivot="center">
          <HierarchicalLayout spacing={[3, 2]} />

          {/* ── Tier 1: Client ────────────────────────────────────────── */}
          <DiagramNode id="browser" label="Web Browser" icon="ui:user" />

          {/* ── Tier 2: CDN / ALB — 'layered' ────────────────────────── */}
          {/*
            layered: path[0] (coloured background rect) = deep slab.
            path[1] (white icon symbol) = raised above it.
            AWS icons are designed exactly as two layers, so this maps perfectly.
          */}
          <DiagramNode id="cdn"    label="CloudFront CDN"  icon="aws:cloudfront"
            clickable metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />
          <DiagramNode id="alb"    label="Load Balancer"   icon="aws:alb"
            clickable metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />

          {/* ── Tier 3: API Gateway — 'layered' ──────────────────────── */}
          <DiagramNode id="api"    label="API Gateway"     icon="aws:api-gateway"
            clickable metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />

          {/* ── Tier 4: Compute ───────────────────────────────────────── */}
          {/*
            extruded: all paths at same depth, no Z separation.
            The PBR side faces catch the fill lights and make the shape readable.
          */}
          <DiagramNode id="ecs"    label="ECS Cluster"     icon="aws:ecs"
            clickable metalness={0.25} roughness={0.35}
            iconStyle="extruded" iconDepth={0.35} />
          {/*
            embossed: shallow extrusion, wide chamfer rim.
            High metalness → strong specular on the bevel — coin / seal look.
          */}
          <DiagramNode id="lambda" label="Lambda"          icon="aws:lambda"
            clickable color="#2a2d4e" metalness={0.55} roughness={0.25}
            iconStyle="embossed" iconDepth={0.32} />

          {/* ── Tier 5: Data — 'layered' ──────────────────────────────── */}
          <DiagramNode id="rds"    label="RDS PostgreSQL"  icon="aws:rds"
            metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />
          <DiagramNode id="cache"  label="ElastiCache"     icon="aws:elasticache"
            metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />
          <DiagramNode id="s3"     label="S3 Assets"       icon="aws:s3"
            metalness={0.25} roughness={0.35}
            iconStyle="layered" iconDepth={0.35} />

          {/* ── Edges ─────────────────────────────────────────────────── */}
          <DiagramEdge from="browser" to="cdn"    label="HTTPS" />
          <DiagramEdge from="cdn"     to="alb" />
          <DiagramEdge from="alb"     to="api" />
          <DiagramEdge from="api"     to="ecs"    label="REST" />
          <DiagramEdge from="api"     to="lambda" label="Events" style="dashed" color="#7788bb" />
          <DiagramEdge from="ecs"     to="rds"    label="TCP 5432" />
          <DiagramEdge from="ecs"     to="cache"  label="Redis" />
          <DiagramEdge from="ecs"     to="s3"     label="r/w"   style="dashed" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
