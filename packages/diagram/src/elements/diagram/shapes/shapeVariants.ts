// Exhaustive shape variant type for diagram nodes.

/**
 * Generic flowchart shapes. Rendered as pure Three.js geometry — no external assets required.
 * These cover all standard ISO 5807 flowchart symbols.
 */
export type FlowShape =
  | 'flow:rect'           // Process / component / service (BoxGeometry)
  | 'flow:rounded'        // Modern service / API endpoint (BoxGeometry + rounded shader)
  | 'flow:diamond'        // Decision / gateway / branch (rotated BoxGeometry)
  | 'flow:cylinder'       // Database / data store (CylinderGeometry)
  | 'flow:cylinder-stack' // Clustered databases / replicated store (stacked cylinders)
  | 'flow:oval'           // Terminator: start / end / user / external system
  | 'flow:cloud'          // External service / internet / third-party (SVG sprite)
  | 'flow:actor'          // Person / user / operator (SVG person icon on plane)
  | 'flow:document'       // Document / report / output artifact (SVG sprite)
  | 'flow:queue'          // Message queue / broker (horizontal cylinder or parallelogram)
  | 'flow:hexagon'        // Compute step / preprocessing (HexagonGeometry)
  | 'flow:parallelogram'; // Data input / output (skewed BoxGeometry)

/**
 * AWS Architecture shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Icon SVGs sourced from official AWS Architecture Icons (CC-BY-ND 2.0).
 * Download: https://aws.amazon.com/architecture/icons/
 */
export type AwsShape =
  | 'aws:ec2'
  | 'aws:s3'
  | 'aws:rds'
  | 'aws:lambda'
  | 'aws:alb'
  | 'aws:cloudfront'
  | 'aws:vpc'
  | 'aws:ecs'
  | 'aws:eks'
  | 'aws:sqs'
  | 'aws:sns'
  | 'aws:api-gateway'
  | 'aws:elasticache'
  | 'aws:dynamodb';

/**
 * Google Cloud Platform shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Icon SVGs sourced from Google Cloud icon set (Apache 2.0).
 * Download: https://cloud.google.com/icons
 */
export type GcpShape =
  | 'gcp:compute-engine'
  | 'gcp:cloud-run'
  | 'gcp:bigquery'
  | 'gcp:cloud-storage'
  | 'gcp:pubsub';

/**
 * Azure shapes. Open string union — enumerate as icons are added.
 * Download: https://learn.microsoft.com/en-us/azure/architecture/icons/
 */
export type AzureShape = `azure:${string}`;

/**
 * Network / infrastructure shapes. Pure Three.js geometry or SVG sprites.
 */
export type NetworkShape =
  | 'net:router'
  | 'net:switch'
  | 'net:firewall'
  | 'net:load-balancer'
  | 'net:server'
  | 'net:desktop'
  | 'net:mobile';

/**
 * Full shape variant union.
 * `custom:${string}` is the escape hatch — unknown custom: shapes fall back to flow:rect
 * at render time with a console.warn. This prevents hard failures for one-off shapes.
 */
export type DiagramShapeVariant =
  | FlowShape
  | AwsShape
  | GcpShape
  | AzureShape
  | NetworkShape
  | `custom:${string}`;

/** Type guard — returns true for shapes that require an external icon asset */
export function shapeRequiresIcon(shape: DiagramShapeVariant): boolean {
  return (
    shape.startsWith('aws:') ||
    shape.startsWith('gcp:') ||
    shape.startsWith('azure:') ||
    shape === 'flow:cloud' ||
    shape === 'flow:actor' ||
    shape === 'flow:document' ||
    shape === 'flow:queue'
  );
}
