// Maps DiagramShapeVariant values to public asset URL paths.

import type { AwsShape, DiagramShapeVariant, GcpShape } from './shapeVariants';

// IMPORTANT: Do NOT type this as Partial<Record<DiagramShapeVariant, string>>.
// DiagramShapeVariant includes AzureShape = `azure:${string}` which is an open
// template literal type. TypeScript cannot enumerate it as Record keys and will error:
// "Type 'Record<DiagramShapeVariant, string>' has infinite/unmappable keys."
// Use an explicit known-key subset type instead.
type KnownIconShape = AwsShape | GcpShape | 'flow:cloud' | 'flow:actor' | 'flow:document' | 'flow:queue';
const ICON_MAP: Partial<Record<KnownIconShape, string>> = {
  // AWS
  'aws:ec2': '/assets/shapes/aws/ec2.svg',
  'aws:s3': '/assets/shapes/aws/s3.svg',
  'aws:rds': '/assets/shapes/aws/rds.svg',
  'aws:lambda': '/assets/shapes/aws/lambda.svg',
  'aws:alb': '/assets/shapes/aws/alb.svg',
  'aws:cloudfront': '/assets/shapes/aws/cloudfront.svg',
  'aws:vpc': '/assets/shapes/aws/vpc.svg',
  'aws:ecs': '/assets/shapes/aws/ecs.svg',
  'aws:eks': '/assets/shapes/aws/eks.svg',
  'aws:sqs': '/assets/shapes/aws/sqs.svg',
  'aws:sns': '/assets/shapes/aws/sns.svg',
  'aws:api-gateway': '/assets/shapes/aws/api-gateway.svg',
  'aws:elasticache': '/assets/shapes/aws/elasticache.svg',
  'aws:dynamodb': '/assets/shapes/aws/dynamodb.svg',
  // GCP
  'gcp:compute-engine': '/assets/shapes/gcp/compute-engine.svg',
  'gcp:cloud-run': '/assets/shapes/gcp/cloud-run.svg',
  'gcp:bigquery': '/assets/shapes/gcp/bigquery.svg',
  'gcp:cloud-storage': '/assets/shapes/gcp/cloud-storage.svg',
  'gcp:pubsub': '/assets/shapes/gcp/pubsub.svg',
  // Flow (SVG-based)
  'flow:cloud': '/assets/shapes/flow/cloud.svg',
  'flow:actor': '/assets/shapes/flow/actor.svg',
  'flow:document': '/assets/shapes/flow/document.svg',
  'flow:queue': '/assets/shapes/flow/queue.svg',
};

/**
 * Returns the public asset URL for a shape's icon, or undefined if the shape
 * is rendered as pure Three.js geometry (no external asset needed).
 */
export function resolveIconUrl(shape: DiagramShapeVariant): string | undefined {
  // Handle azure:* open union and custom:* escape hatch
  if (shape.startsWith('azure:')) {
    const key = shape.replace('azure:', '');
    return `/assets/shapes/azure/${key}.svg`;
  }
  return ICON_MAP[shape as keyof typeof ICON_MAP];
}
