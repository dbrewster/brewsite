// Maps DiagramIconVariant values to public asset URL paths.

import type {
  DiagramIconVariant,
  AwsShape,
  AzureShape,
  DataShape,
  GcpShape,
  NetworkShape,
  SecurityShape,
  TechShape,
  UiShape,
} from './shapeVariants';

// ─── URL base paths per namespace ────────────────────────────────────────────

const BASE = '/assets/shapes';

// ─── ui: namespace ───────────────────────────────────────────────────────────

// All UiShape names map directly to /assets/shapes/ui/{name}.svg.
// No manual listing needed — the name IS the filename (populated by sync-icons.mjs).

// ─── tech: namespace ─────────────────────────────────────────────────────────

// All TechShape names map directly to /assets/shapes/tech/{name}.svg.
// sync-icons.mjs handles the slug translation (e.g. nextjs→nextdotjs.svg).

// ─── security: namespace ─────────────────────────────────────────────────────

// All SecurityShape names map directly to /assets/shapes/security/{name}.svg.

// ─── data: namespace ─────────────────────────────────────────────────────────

// All DataShape names map directly to /assets/shapes/data/{name}.svg.

// ─── net: namespace ──────────────────────────────────────────────────────────

// All NetworkShape names map directly to /assets/shapes/net/{name}.svg.

// ─── aws: explicit map ───────────────────────────────────────────────────────

// IMPORTANT: Do NOT type this as Partial<Record<DiagramShapeVariant, string>>.
// DiagramShapeVariant includes open template literal types (AzureShape, custom:${string})
// which TypeScript cannot enumerate as Record keys.
// Use explicit known-key subset types instead.

// flow:cloud and flow:document moved to DiagramNodeShape (geometry-only).
// flow:actor and flow:queue remain as icon overlays.
type KnownFlowIconShape = 'flow:actor' | 'flow:queue';

const FLOW_ICON_MAP: Record<KnownFlowIconShape, string> = {
  'flow:actor': `${BASE}/flow/actor.svg`,
  'flow:queue': `${BASE}/flow/queue.svg`,
};

const AWS_ICON_MAP: Record<AwsShape, string> = {
  // Compute
  'aws:ec2':                      `${BASE}/aws/ec2.svg`,
  'aws:ecs':                      `${BASE}/aws/ecs.svg`,
  'aws:eks':                      `${BASE}/aws/eks.svg`,
  'aws:lambda':                   `${BASE}/aws/lambda.svg`,
  'aws:fargate':                  `${BASE}/aws/fargate.svg`,
  'aws:lightsail':                `${BASE}/aws/lightsail.svg`,
  'aws:batch':                    `${BASE}/aws/batch.svg`,
  'aws:app-runner':               `${BASE}/aws/app-runner.svg`,
  'aws:outposts':                 `${BASE}/aws/outposts.svg`,
  // Storage
  'aws:s3':                       `${BASE}/aws/s3.svg`,
  'aws:efs':                      `${BASE}/aws/efs.svg`,
  'aws:fsx':                      `${BASE}/aws/fsx.svg`,
  'aws:glacier':                  `${BASE}/aws/glacier.svg`,
  'aws:backup':                   `${BASE}/aws/backup.svg`,
  'aws:storage-gateway':          `${BASE}/aws/storage-gateway.svg`,
  // Database
  'aws:rds':                      `${BASE}/aws/rds.svg`,
  'aws:aurora':                   `${BASE}/aws/aurora.svg`,
  'aws:dynamodb':                 `${BASE}/aws/dynamodb.svg`,
  'aws:elasticache':              `${BASE}/aws/elasticache.svg`,
  'aws:redshift':                 `${BASE}/aws/redshift.svg`,
  'aws:neptune':                  `${BASE}/aws/neptune.svg`,
  'aws:documentdb':               `${BASE}/aws/documentdb.svg`,
  'aws:timestream':               `${BASE}/aws/timestream.svg`,
  'aws:keyspaces':                `${BASE}/aws/keyspaces.svg`,
  'aws:qldb':                     `${BASE}/aws/qldb.svg`,
  // Networking
  'aws:vpc':                      `${BASE}/aws/vpc.svg`,
  'aws:alb':                      `${BASE}/aws/alb.svg`,
  'aws:cloudfront':               `${BASE}/aws/cloudfront.svg`,
  'aws:route53':                  `${BASE}/aws/route53.svg`,
  'aws:direct-connect':           `${BASE}/aws/direct-connect.svg`,
  'aws:transit-gateway':          `${BASE}/aws/transit-gateway.svg`,
  'aws:waf':                      `${BASE}/aws/waf.svg`,
  'aws:shield-service':           `${BASE}/aws/shield-service.svg`,
  'aws:nat-gateway':              `${BASE}/aws/nat-gateway.svg`,
  'aws:global-accelerator':       `${BASE}/aws/global-accelerator.svg`,
  'aws:privatelink':              `${BASE}/aws/privatelink.svg`,
  // Integration
  'aws:sqs':                      `${BASE}/aws/sqs.svg`,
  'aws:sns':                      `${BASE}/aws/sns.svg`,
  'aws:api-gateway':              `${BASE}/aws/api-gateway.svg`,
  'aws:step-functions':           `${BASE}/aws/step-functions.svg`,
  'aws:eventbridge':              `${BASE}/aws/eventbridge.svg`,
  'aws:msk':                      `${BASE}/aws/msk.svg`,
  'aws:kinesis':                  `${BASE}/aws/kinesis.svg`,
  'aws:appflow':                  `${BASE}/aws/appflow.svg`,
  'aws:mq':                       `${BASE}/aws/mq.svg`,
  'aws:appsync':                  `${BASE}/aws/appsync.svg`,
  // Security & Identity
  'aws:iam':                      `${BASE}/aws/iam.svg`,
  'aws:cognito':                  `${BASE}/aws/cognito.svg`,
  'aws:kms':                      `${BASE}/aws/kms.svg`,
  'aws:secrets-manager':          `${BASE}/aws/secrets-manager.svg`,
  'aws:certificate-manager':      `${BASE}/aws/certificate-manager.svg`,
  'aws:guardduty':                `${BASE}/aws/guardduty.svg`,
  'aws:security-hub':             `${BASE}/aws/security-hub.svg`,
  'aws:inspector':                `${BASE}/aws/inspector.svg`,
  'aws:macie':                    `${BASE}/aws/macie.svg`,
  // Developer Tools & Management
  'aws:codepipeline':             `${BASE}/aws/codepipeline.svg`,
  'aws:codebuild':                `${BASE}/aws/codebuild.svg`,
  'aws:codedeploy':               `${BASE}/aws/codedeploy.svg`,
  'aws:cloud9':                   `${BASE}/aws/cloud9.svg`,
  'aws:x-ray':                    `${BASE}/aws/x-ray.svg`,
  'aws:cloudwatch':               `${BASE}/aws/cloudwatch.svg`,
  'aws:cloudtrail':               `${BASE}/aws/cloudtrail.svg`,
  'aws:cloudformation':           `${BASE}/aws/cloudformation.svg`,
  'aws:systems-manager':          `${BASE}/aws/systems-manager.svg`,
  'aws:control-tower':            `${BASE}/aws/control-tower.svg`,
  'aws:organizations':            `${BASE}/aws/organizations.svg`,
  'aws:amplify':                  `${BASE}/aws/amplify.svg`,
  // Analytics
  'aws:athena':                   `${BASE}/aws/athena.svg`,
  'aws:glue':                     `${BASE}/aws/glue.svg`,
  'aws:emr':                      `${BASE}/aws/emr.svg`,
  'aws:quicksight':               `${BASE}/aws/quicksight.svg`,
  'aws:lakeformation':            `${BASE}/aws/lakeformation.svg`,
  'aws:kinesis-data-analytics':   `${BASE}/aws/kinesis-data-analytics.svg`,
  'aws:opensearch':               `${BASE}/aws/opensearch.svg`,
  'aws:datazone':                 `${BASE}/aws/datazone.svg`,
  // AI/ML
  'aws:sagemaker':                `${BASE}/aws/sagemaker.svg`,
  'aws:bedrock':                  `${BASE}/aws/bedrock.svg`,
  'aws:rekognition':              `${BASE}/aws/rekognition.svg`,
  'aws:polly':                    `${BASE}/aws/polly.svg`,
  'aws:transcribe':               `${BASE}/aws/transcribe.svg`,
  'aws:translate':                `${BASE}/aws/translate.svg`,
  'aws:comprehend':               `${BASE}/aws/comprehend.svg`,
  'aws:textract':                 `${BASE}/aws/textract.svg`,
  // IoT
  'aws:iot-core':                 `${BASE}/aws/iot-core.svg`,
  'aws:greengrass':               `${BASE}/aws/greengrass.svg`,
  // Media
  'aws:ivs':                      `${BASE}/aws/ivs.svg`,
};

const GCP_ICON_MAP: Record<GcpShape, string> = {
  'gcp:compute-engine':   `${BASE}/gcp/compute-engine.svg`,
  'gcp:cloud-run':        `${BASE}/gcp/cloud-run.svg`,
  'gcp:bigquery':         `${BASE}/gcp/bigquery.svg`,
  'gcp:cloud-storage':    `${BASE}/gcp/cloud-storage.svg`,
  'gcp:pubsub':           `${BASE}/gcp/pubsub.svg`,
  'gcp:gke':              `${BASE}/gcp/gke.svg`,
  'gcp:cloud-functions':  `${BASE}/gcp/cloud-functions.svg`,
  'gcp:cloud-sql':        `${BASE}/gcp/cloud-sql.svg`,
  'gcp:cloud-spanner':    `${BASE}/gcp/cloud-spanner.svg`,
  'gcp:firebase':         `${BASE}/gcp/firebase.svg`,
  'gcp:firestore':        `${BASE}/gcp/firestore.svg`,
  'gcp:bigtable':         `${BASE}/gcp/bigtable.svg`,
  'gcp:dataflow':         `${BASE}/gcp/dataflow.svg`,
  'gcp:dataproc':         `${BASE}/gcp/dataproc.svg`,
  'gcp:vertex-ai':        `${BASE}/gcp/vertex-ai.svg`,
  'gcp:cloud-build':      `${BASE}/gcp/cloud-build.svg`,
  'gcp:artifact-registry':`${BASE}/gcp/artifact-registry.svg`,
  'gcp:cloud-dns':        `${BASE}/gcp/cloud-dns.svg`,
  'gcp:cloud-armor':      `${BASE}/gcp/cloud-armor.svg`,
  'gcp:cloud-nat':        `${BASE}/gcp/cloud-nat.svg`,
  'gcp:vpc-network':      `${BASE}/gcp/vpc-network.svg`,
  'gcp:load-balancing':   `${BASE}/gcp/load-balancing.svg`,
  'gcp:secret-manager':   `${BASE}/gcp/secret-manager.svg`,
  'gcp:iam':              `${BASE}/gcp/iam.svg`,
  'gcp:cloud-monitoring': `${BASE}/gcp/cloud-monitoring.svg`,
  'gcp:cloud-logging':    `${BASE}/gcp/cloud-logging.svg`,
  'gcp:cloud-trace':      `${BASE}/gcp/cloud-trace.svg`,
  'gcp:memorystore':      `${BASE}/gcp/memorystore.svg`,
  'gcp:workflows':        `${BASE}/gcp/workflows.svg`,
  'gcp:eventarc':         `${BASE}/gcp/eventarc.svg`,
  'gcp:apigee':           `${BASE}/gcp/apigee.svg`,
  'gcp:cloud-cdn':        `${BASE}/gcp/cloud-cdn.svg`,
  'gcp:looker':           `${BASE}/gcp/looker.svg`,
  'gcp:alloydb':          `${BASE}/gcp/alloydb.svg`,
  'gcp:datastream':       `${BASE}/gcp/datastream.svg`,
  'gcp:dataform':         `${BASE}/gcp/dataform.svg`,
  'gcp:cloud-run-jobs':   `${BASE}/gcp/cloud-run-jobs.svg`,
  'gcp:cloud-scheduler':  `${BASE}/gcp/cloud-scheduler.svg`,
  'gcp:cloud-tasks':      `${BASE}/gcp/cloud-tasks.svg`,
  'gcp:identity-platform':`${BASE}/gcp/identity-platform.svg`,
};

const AZURE_ICON_MAP: Record<AzureShape, string> = {
  // Compute
  'azure:virtual-machine':       `${BASE}/azure/virtual-machine.svg`,
  'azure:app-service':           `${BASE}/azure/app-service.svg`,
  'azure:functions':             `${BASE}/azure/functions.svg`,
  'azure:aks':                   `${BASE}/azure/aks.svg`,
  'azure:container-instances':   `${BASE}/azure/container-instances.svg`,
  'azure:batch':                 `${BASE}/azure/batch.svg`,
  'azure:spring-apps':           `${BASE}/azure/spring-apps.svg`,
  // Storage
  'azure:storage-account':       `${BASE}/azure/storage-account.svg`,
  'azure:blob-storage':          `${BASE}/azure/blob-storage.svg`,
  'azure:data-lake':             `${BASE}/azure/data-lake.svg`,
  'azure:managed-disk':          `${BASE}/azure/managed-disk.svg`,
  'azure:files':                 `${BASE}/azure/files.svg`,
  // Database
  'azure:sql-database':          `${BASE}/azure/sql-database.svg`,
  'azure:cosmos-db':             `${BASE}/azure/cosmos-db.svg`,
  'azure:cache-for-redis':       `${BASE}/azure/cache-for-redis.svg`,
  'azure:database-for-postgres': `${BASE}/azure/database-for-postgres.svg`,
  'azure:synapse-analytics':     `${BASE}/azure/synapse-analytics.svg`,
  'azure:database-for-mysql':    `${BASE}/azure/database-for-mysql.svg`,
  // Networking
  'azure:virtual-network':       `${BASE}/azure/virtual-network.svg`,
  'azure:load-balancer':         `${BASE}/azure/load-balancer.svg`,
  'azure:application-gateway':   `${BASE}/azure/application-gateway.svg`,
  'azure:front-door':            `${BASE}/azure/front-door.svg`,
  'azure:cdn':                   `${BASE}/azure/cdn.svg`,
  'azure:vpn-gateway':           `${BASE}/azure/vpn-gateway.svg`,
  'azure:firewall':              `${BASE}/azure/firewall.svg`,
  'azure:dns':                   `${BASE}/azure/dns.svg`,
  'azure:private-link':          `${BASE}/azure/private-link.svg`,
  'azure:nat-gateway':           `${BASE}/azure/nat-gateway.svg`,
  // Integration
  'azure:service-bus':           `${BASE}/azure/service-bus.svg`,
  'azure:event-hubs':            `${BASE}/azure/event-hubs.svg`,
  'azure:event-grid':            `${BASE}/azure/event-grid.svg`,
  'azure:logic-apps':            `${BASE}/azure/logic-apps.svg`,
  'azure:api-management':        `${BASE}/azure/api-management.svg`,
  'azure:service-connector':     `${BASE}/azure/service-connector.svg`,
  // Security
  'azure:active-directory':      `${BASE}/azure/active-directory.svg`,
  'azure:key-vault':             `${BASE}/azure/key-vault.svg`,
  'azure:defender':              `${BASE}/azure/defender.svg`,
  'azure:sentinel':              `${BASE}/azure/sentinel.svg`,
  'azure:ddos-protection':       `${BASE}/azure/ddos-protection.svg`,
  // DevOps
  'azure:devops':                `${BASE}/azure/devops.svg`,
  'azure:pipelines':             `${BASE}/azure/pipelines.svg`,
  'azure:repos':                 `${BASE}/azure/repos.svg`,
  'azure:boards':                `${BASE}/azure/boards.svg`,
  // AI & ML
  'azure:cognitive-services':    `${BASE}/azure/cognitive-services.svg`,
  'azure:openai':                `${BASE}/azure/openai.svg`,
  'azure:machine-learning':      `${BASE}/azure/machine-learning.svg`,
  'azure:bot-service':           `${BASE}/azure/bot-service.svg`,
  // Management
  'azure:monitor':               `${BASE}/azure/monitor.svg`,
  'azure:policy':                `${BASE}/azure/policy.svg`,
  'azure:resource-groups':       `${BASE}/azure/resource-groups.svg`,
  'azure:cost-management':       `${BASE}/azure/cost-management.svg`,
  'azure:automation':            `${BASE}/azure/automation.svg`,
  // Data & Analytics
  'azure:data-factory':          `${BASE}/azure/data-factory.svg`,
  'azure:databricks':            `${BASE}/azure/databricks.svg`,
  'azure:stream-analytics':      `${BASE}/azure/stream-analytics.svg`,
  'azure:analysis-services':     `${BASE}/azure/analysis-services.svg`,
};

const NET_ICON_MAP: Record<NetworkShape, string> = {
  'net:router':       `${BASE}/net/router.svg`,
  'net:switch':       `${BASE}/net/switch.svg`,
  'net:firewall':     `${BASE}/net/firewall.svg`,
  'net:load-balancer':`${BASE}/net/load-balancer.svg`,
  'net:server':       `${BASE}/net/server.svg`,
  'net:desktop':      `${BASE}/net/desktop.svg`,
  'net:mobile':       `${BASE}/net/mobile.svg`,
  'net:dns':          `${BASE}/net/dns.svg`,
  'net:vpn':          `${BASE}/net/vpn.svg`,
  'net:proxy':        `${BASE}/net/proxy.svg`,
  'net:nat':          `${BASE}/net/nat.svg`,
  'net:rack':         `${BASE}/net/rack.svg`,
  'net:datacenter':   `${BASE}/net/datacenter.svg`,
  'net:cluster':      `${BASE}/net/cluster.svg`,
  'net:cdn-pop':      `${BASE}/net/cdn-pop.svg`,
  'net:wifi-ap':      `${BASE}/net/wifi-ap.svg`,
  'net:segment':      `${BASE}/net/segment.svg`,
  'net:packet':       `${BASE}/net/packet.svg`,
  'net:wan':          `${BASE}/net/wan.svg`,
  'net:vlan':         `${BASE}/net/vlan.svg`,
  'net:peering':      `${BASE}/net/peering.svg`,
  'net:bgp':          `${BASE}/net/bgp.svg`,
  'net:private-link': `${BASE}/net/private-link.svg`,
  'net:internet':     `${BASE}/net/internet.svg`,
  'net:tablet':       `${BASE}/net/tablet.svg`,
};

// Inline maps for closed namespaces where the name IS the filename stem
function namespaceUrl(ns: string, name: string): string {
  return `${BASE}/${ns}/${name}.svg`;
}

/**
 * Extracts the icon name from a namespaced shape string.
 * e.g. 'ui:server-stack' → 'server-stack'
 */
function iconName(shape: string): string {
  return shape.slice(shape.indexOf(':') + 1);
}

/**
 * Returns the public asset URL for an icon variant, or undefined if the variant
 * has no known asset (e.g. custom: without a registered URL, or undefined input).
 */
export function resolveIconUrl(icon: DiagramIconVariant | undefined): string | undefined {
  if (icon === undefined) return undefined;

  // Heroicons-derived namespaces: name IS the filename
  if (icon.startsWith('ui:'))       return namespaceUrl('ui',       iconName(icon));
  if (icon.startsWith('tech:'))     return namespaceUrl('tech',     iconName(icon));
  if (icon.startsWith('security:')) return namespaceUrl('security', iconName(icon));
  if (icon.startsWith('data:'))     return namespaceUrl('data',     iconName(icon));
  if (icon.startsWith('net:'))      return NET_ICON_MAP[icon as NetworkShape];

  // Cloud provider namespaces
  if (icon.startsWith('aws:'))      return AWS_ICON_MAP[icon as AwsShape];
  if (icon.startsWith('gcp:'))      return GCP_ICON_MAP[icon as GcpShape];
  if (icon.startsWith('azure:'))    return AZURE_ICON_MAP[icon as AzureShape];

  // Flow SVG sprites (actor, queue)
  return FLOW_ICON_MAP[icon as KnownFlowIconShape];
}
