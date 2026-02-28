// Geometry shape and icon variant types for diagram nodes.

// ─── Geometry shapes ─────────────────────────────────────────────────────────

/**
 * Controls the 3D geometry prism rendered for a diagram node.
 * Polygon shapes are rendered as N-sided prisms using CylinderGeometry.
 * Special shapes use custom ExtrudeGeometry paths.
 * Default: 'rectangle'.
 */
export type DiagramNodeShape =
  // Regular polygon prisms
  | 'circle'        // 32-sided smooth prism
  | 'triangle'      // 3-sided prism
  | 'square'        // 4-sided equal-axis box (use equal size prop for true square)
  | 'rectangle'     // 4-sided free-aspect box — DEFAULT
  | 'pentagon'      // 5-sided prism
  | 'hexagon'       // 6-sided prism (was flow:hexagon)
  | 'heptagon'      // 7-sided prism
  | 'octagon'       // 8-sided prism
  | 'nonagon'       // 9-sided prism
  | 'decagon'       // 10-sided prism
  // Special 2D shapes (ExtrudeGeometry)
  | 'diamond'       // rotated square (was flow:diamond)
  | 'oval'          // elliptical prism (was flow:oval)
  | 'cloud'         // cloud silhouette extruded shape (was flow:cloud — geometry only, no icon)
  | 'document'      // page with folded corner (was flow:document — geometry only, no icon)
  | 'parallelogram' // sheared rectangle (was flow:parallelogram);

/** Default node shape applied when none is specified in the DSL. */
export const DEFAULT_NODE_SHAPE: DiagramNodeShape = 'rectangle';

// ─── Icon variants ────────────────────────────────────────────────────────────

/**
 * Legacy flow icon shapes — SVG overlays rendered on the node face.
 * flow:actor: legacy stick-person icon; prefer ui:user for new scenes.
 * flow:cylinder, flow:cylinder-stack, flow:queue: 3D shapes deferred to a future
 *   geometry extension; kept here as icon-only overlays on rectangle bases.
 */
export type FlowIconShape =
  | 'flow:actor'
  | 'flow:cylinder'
  | 'flow:cylinder-stack'
  | 'flow:queue';

/**
 * General-purpose UI icons from Heroicons 24/outline (MIT license).
 * Source: https://heroicons.com — Tailwind Labs.
 * SVGs live at /assets/shapes/ui/{name}.svg.
 * Sync with: node scripts/sync-icons.mjs
 */
export type UiShape =
  // Compute & Infrastructure
  | 'ui:server'
  | 'ui:server-stack'
  | 'ui:cpu-chip'
  | 'ui:circle-stack'
  | 'ui:cloud'
  | 'ui:cloud-arrow-up'
  | 'ui:cloud-arrow-down'
  | 'ui:signal'
  | 'ui:wifi'
  | 'ui:globe-alt'
  | 'ui:globe-americas'
  // Users & Organisation
  | 'ui:user'
  | 'ui:users'
  | 'ui:user-group'
  | 'ui:user-circle'
  | 'ui:identification'
  | 'ui:building-office'
  | 'ui:building-office-2'
  | 'ui:home'
  | 'ui:map-pin'
  | 'ui:building-library'
  // Security
  | 'ui:shield-check'
  | 'ui:shield-exclamation'
  | 'ui:lock-closed'
  | 'ui:lock-open'
  | 'ui:key'
  | 'ui:finger-print'
  | 'ui:eye'
  | 'ui:eye-slash'
  // Data & Documents
  | 'ui:folder'
  | 'ui:folder-open'
  | 'ui:document'
  | 'ui:document-text'
  | 'ui:document-chart-bar'
  | 'ui:document-magnifying-glass'
  | 'ui:clipboard'
  | 'ui:table-cells'
  | 'ui:archive-box'
  | 'ui:archive-box-arrow-down'
  | 'ui:inbox'
  | 'ui:inbox-stack'
  // Monitoring & Status
  | 'ui:check-circle'
  | 'ui:x-circle'
  | 'ui:exclamation-circle'
  | 'ui:information-circle'
  | 'ui:exclamation-triangle'
  | 'ui:chart-bar'
  | 'ui:chart-bar-square'
  | 'ui:chart-pie'
  | 'ui:presentation-chart-bar'
  | 'ui:presentation-chart-line'
  | 'ui:fire'
  | 'ui:bolt'
  // Code & Dev
  | 'ui:code-bracket'
  | 'ui:code-bracket-square'
  | 'ui:command-line'
  | 'ui:bug-ant'
  | 'ui:beaker'
  | 'ui:wrench-screwdriver'
  | 'ui:puzzle-piece'
  | 'ui:squares-2x2'
  | 'ui:squares-plus'
  // Communication & Flow
  | 'ui:chat-bubble-left'
  | 'ui:chat-bubble-left-right'
  | 'ui:envelope'
  | 'ui:phone'
  | 'ui:bell'
  | 'ui:megaphone'
  | 'ui:rss'
  | 'ui:paper-airplane'
  | 'ui:microphone'
  // Actions & Navigation
  | 'ui:arrow-path'
  | 'ui:arrow-path-rounded-square'
  | 'ui:arrows-right-left'
  | 'ui:arrows-pointing-out'
  | 'ui:arrows-pointing-in'
  | 'ui:cog-6-tooth'
  | 'ui:cog-8-tooth'
  | 'ui:adjustments-horizontal'
  | 'ui:adjustments-vertical'
  | 'ui:magnifying-glass'
  | 'ui:funnel'
  | 'ui:tag'
  | 'ui:bookmark'
  | 'ui:wrench'
  | 'ui:language'
  // Finance
  | 'ui:credit-card'
  | 'ui:banknotes'
  | 'ui:currency-dollar'
  | 'ui:shopping-cart'
  | 'ui:receipt-percent'
  | 'ui:gift'
  | 'ui:flag'
  // Devices
  | 'ui:computer-desktop'
  | 'ui:device-phone-mobile'
  | 'ui:device-tablet'
  | 'ui:printer'
  // Misc
  | 'ui:academic-cap'
  | 'ui:light-bulb'
  | 'ui:trophy'
  | 'ui:heart'
  | 'ui:star'
  | 'ui:sparkles'
  | 'ui:paint-brush'
  | 'ui:swatch'
  | 'ui:photo'
  | 'ui:film'
  | 'ui:musical-note';

/**
 * Technology brand and tool icons sourced from Simple Icons (MIT license).
 * Source: https://simpleicons.org
 * SVGs live at /assets/shapes/tech/{name}.svg.
 * Sync with: node scripts/sync-icons.mjs
 */
export type TechShape =
  // Languages
  | 'tech:typescript'
  | 'tech:javascript'
  | 'tech:python'
  | 'tech:go'
  | 'tech:rust'
  | 'tech:dotnet'
  | 'tech:ruby'
  | 'tech:php'
  | 'tech:swift'
  | 'tech:kotlin'
  | 'tech:scala'
  | 'tech:elixir'
  // Databases
  | 'tech:postgresql'
  | 'tech:mysql'
  | 'tech:mongodb'
  | 'tech:redis'
  | 'tech:elasticsearch'
  | 'tech:cassandra'
  | 'tech:sqlite'
  | 'tech:influxdb'
  | 'tech:neo4j'
  | 'tech:cockroachdb'
  | 'tech:clickhouse'
  | 'tech:snowflake'
  // Message Queues & Streaming
  | 'tech:kafka'
  | 'tech:rabbitmq'
  | 'tech:nats'
  // CI/CD & GitOps
  | 'tech:github'
  | 'tech:gitlab'
  | 'tech:bitbucket'
  | 'tech:jenkins'
  | 'tech:circleci'
  | 'tech:github-actions'
  | 'tech:argocd'
  | 'tech:flux'
  | 'tech:drone'
  // Containers & Infrastructure-as-Code
  | 'tech:docker'
  | 'tech:kubernetes'
  | 'tech:helm'
  | 'tech:terraform'
  | 'tech:ansible'
  | 'tech:pulumi'
  | 'tech:bun'
  // Monitoring & Observability
  | 'tech:prometheus'
  | 'tech:grafana'
  | 'tech:datadog'
  | 'tech:splunk'
  | 'tech:elastic'
  | 'tech:jaeger'
  | 'tech:opentelemetry'
  | 'tech:pagerduty'
  | 'tech:opsgenie'
  // Web Frameworks & Runtimes
  | 'tech:react'
  | 'tech:nextjs'
  | 'tech:vue'
  | 'tech:nuxtjs'
  | 'tech:angular'
  | 'tech:svelte'
  | 'tech:astro'
  | 'tech:remix'
  | 'tech:nodejs'
  | 'tech:deno'
  | 'tech:fastapi'
  | 'tech:django'
  | 'tech:rails'
  // Proxies, API & Networking
  | 'tech:nginx'
  | 'tech:apache'
  | 'tech:envoy'
  | 'tech:istio'
  | 'tech:kong'
  | 'tech:traefik'
  // Auth & Identity
  | 'tech:auth0'
  | 'tech:keycloak'
  | 'tech:okta'
  // AI/ML
  | 'tech:huggingface'
  | 'tech:tensorflow'
  | 'tech:pytorch'
  | 'tech:langchain'
  // Collaboration & Productivity
  | 'tech:discord'
  | 'tech:jira'
  | 'tech:confluence'
  | 'tech:figma'
  | 'tech:notion';

/**
 * Security-concept icons (heroicons remapped with semantic names).
 * SVGs live at /assets/shapes/security/{name}.svg.
 */
export type SecurityShape =
  | 'security:shield'
  | 'security:shield-alert'
  | 'security:lock'
  | 'security:unlock'
  | 'security:key'
  | 'security:fingerprint'
  | 'security:eye'
  | 'security:eye-hidden'
  | 'security:certificate'
  | 'security:audit'
  | 'security:alert'
  | 'security:mfa'
  | 'security:vpn'
  | 'security:waf'
  | 'security:ddos'
  | 'security:threat'
  | 'security:incident'
  | 'security:scan'
  | 'security:token'
  | 'security:policy'
  | 'security:compliance'
  | 'security:rbac'
  | 'security:sso'
  | 'security:sandbox'
  | 'security:encryption';

/**
 * Data pipeline / analytics concept icons (heroicons remapped with semantic names).
 * SVGs live at /assets/shapes/data/{name}.svg.
 */
export type DataShape =
  | 'data:pipeline'
  | 'data:stream'
  | 'data:batch'
  | 'data:warehouse'
  | 'data:lake'
  | 'data:etl'
  | 'data:transform'
  | 'data:aggregate'
  | 'data:schema'
  | 'data:partition'
  | 'data:query'
  | 'data:report'
  | 'data:dashboard'
  | 'data:event'
  | 'data:webhook'
  | 'data:api'
  | 'data:cdc'
  | 'data:lineage'
  | 'data:catalog'
  | 'data:mart';

/**
 * AWS Architecture shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Official icons (CC-BY-ND 2.0): https://aws.amazon.com/architecture/icons/
 * New service icons use Heroicons placeholders until official icons are downloaded.
 * See scripts/download-cloud-icons.mjs for instructions.
 */
export type AwsShape =
  // Compute
  | 'aws:ec2'
  | 'aws:ecs'
  | 'aws:eks'
  | 'aws:lambda'
  | 'aws:fargate'
  | 'aws:lightsail'
  | 'aws:batch'
  | 'aws:app-runner'
  | 'aws:outposts'
  // Storage
  | 'aws:s3'
  | 'aws:efs'
  | 'aws:fsx'
  | 'aws:glacier'
  | 'aws:backup'
  | 'aws:storage-gateway'
  // Database
  | 'aws:rds'
  | 'aws:aurora'
  | 'aws:dynamodb'
  | 'aws:elasticache'
  | 'aws:redshift'
  | 'aws:neptune'
  | 'aws:documentdb'
  | 'aws:timestream'
  | 'aws:keyspaces'
  | 'aws:qldb'
  // Networking
  | 'aws:vpc'
  | 'aws:alb'
  | 'aws:cloudfront'
  | 'aws:route53'
  | 'aws:direct-connect'
  | 'aws:transit-gateway'
  | 'aws:waf'
  | 'aws:shield-service'
  | 'aws:nat-gateway'
  | 'aws:global-accelerator'
  | 'aws:privatelink'
  // Integration
  | 'aws:sqs'
  | 'aws:sns'
  | 'aws:api-gateway'
  | 'aws:step-functions'
  | 'aws:eventbridge'
  | 'aws:msk'
  | 'aws:kinesis'
  | 'aws:appflow'
  | 'aws:mq'
  | 'aws:appsync'
  // Security & Identity
  | 'aws:iam'
  | 'aws:cognito'
  | 'aws:kms'
  | 'aws:secrets-manager'
  | 'aws:certificate-manager'
  | 'aws:guardduty'
  | 'aws:security-hub'
  | 'aws:inspector'
  | 'aws:macie'
  // Developer Tools & Management
  | 'aws:codepipeline'
  | 'aws:codebuild'
  | 'aws:codedeploy'
  | 'aws:cloud9'
  | 'aws:x-ray'
  | 'aws:cloudwatch'
  | 'aws:cloudtrail'
  | 'aws:cloudformation'
  | 'aws:systems-manager'
  | 'aws:control-tower'
  | 'aws:organizations'
  | 'aws:amplify'
  // Analytics
  | 'aws:athena'
  | 'aws:glue'
  | 'aws:emr'
  | 'aws:quicksight'
  | 'aws:lakeformation'
  | 'aws:kinesis-data-analytics'
  | 'aws:opensearch'
  | 'aws:datazone'
  // AI/ML
  | 'aws:sagemaker'
  | 'aws:bedrock'
  | 'aws:rekognition'
  | 'aws:polly'
  | 'aws:transcribe'
  | 'aws:translate'
  | 'aws:comprehend'
  | 'aws:textract'
  // IoT
  | 'aws:iot-core'
  | 'aws:greengrass'
  // Media
  | 'aws:ivs';

/**
 * Google Cloud Platform shapes. Rendered as PlaneGeometry with SVGLoader texture.
 * Official icons (Apache 2.0): https://cloud.google.com/icons
 * New service icons use Heroicons placeholders until official icons are downloaded.
 */
export type GcpShape =
  | 'gcp:compute-engine'
  | 'gcp:cloud-run'
  | 'gcp:bigquery'
  | 'gcp:cloud-storage'
  | 'gcp:pubsub'
  | 'gcp:gke'
  | 'gcp:cloud-functions'
  | 'gcp:cloud-sql'
  | 'gcp:cloud-spanner'
  | 'gcp:firebase'
  | 'gcp:firestore'
  | 'gcp:bigtable'
  | 'gcp:dataflow'
  | 'gcp:dataproc'
  | 'gcp:vertex-ai'
  | 'gcp:cloud-build'
  | 'gcp:artifact-registry'
  | 'gcp:cloud-dns'
  | 'gcp:cloud-armor'
  | 'gcp:cloud-nat'
  | 'gcp:vpc-network'
  | 'gcp:load-balancing'
  | 'gcp:secret-manager'
  | 'gcp:iam'
  | 'gcp:cloud-monitoring'
  | 'gcp:cloud-logging'
  | 'gcp:cloud-trace'
  | 'gcp:memorystore'
  | 'gcp:workflows'
  | 'gcp:eventarc'
  | 'gcp:apigee'
  | 'gcp:cloud-cdn'
  | 'gcp:looker'
  | 'gcp:alloydb'
  | 'gcp:datastream'
  | 'gcp:dataform'
  | 'gcp:cloud-run-jobs'
  | 'gcp:cloud-scheduler'
  | 'gcp:cloud-tasks'
  | 'gcp:identity-platform';

/**
 * Azure shapes. Closed union with known services.
 * Official icons: https://learn.microsoft.com/en-us/azure/architecture/icons/
 * Icons use Heroicons placeholders; see scripts/download-cloud-icons.mjs.
 */
export type AzureShape =
  // Compute
  | 'azure:virtual-machine'
  | 'azure:app-service'
  | 'azure:functions'
  | 'azure:aks'
  | 'azure:container-instances'
  | 'azure:batch'
  | 'azure:spring-apps'
  // Storage
  | 'azure:storage-account'
  | 'azure:blob-storage'
  | 'azure:data-lake'
  | 'azure:managed-disk'
  | 'azure:files'
  // Database
  | 'azure:sql-database'
  | 'azure:cosmos-db'
  | 'azure:cache-for-redis'
  | 'azure:database-for-postgres'
  | 'azure:synapse-analytics'
  | 'azure:database-for-mysql'
  // Networking
  | 'azure:virtual-network'
  | 'azure:load-balancer'
  | 'azure:application-gateway'
  | 'azure:front-door'
  | 'azure:cdn'
  | 'azure:vpn-gateway'
  | 'azure:firewall'
  | 'azure:dns'
  | 'azure:private-link'
  | 'azure:nat-gateway'
  // Integration
  | 'azure:service-bus'
  | 'azure:event-hubs'
  | 'azure:event-grid'
  | 'azure:logic-apps'
  | 'azure:api-management'
  | 'azure:service-connector'
  // Security
  | 'azure:active-directory'
  | 'azure:key-vault'
  | 'azure:defender'
  | 'azure:sentinel'
  | 'azure:ddos-protection'
  // DevOps
  | 'azure:devops'
  | 'azure:pipelines'
  | 'azure:repos'
  | 'azure:boards'
  // AI & ML
  | 'azure:cognitive-services'
  | 'azure:openai'
  | 'azure:machine-learning'
  | 'azure:bot-service'
  // Management
  | 'azure:monitor'
  | 'azure:policy'
  | 'azure:resource-groups'
  | 'azure:cost-management'
  | 'azure:automation'
  // Data & Analytics
  | 'azure:data-factory'
  | 'azure:databricks'
  | 'azure:stream-analytics'
  | 'azure:analysis-services';

/**
 * Network / infrastructure topology shapes.
 * SVGs live at /assets/shapes/net/{name}.svg (heroicons remapped).
 */
export type NetworkShape =
  | 'net:router'
  | 'net:switch'
  | 'net:firewall'
  | 'net:load-balancer'
  | 'net:server'
  | 'net:desktop'
  | 'net:mobile'
  | 'net:dns'
  | 'net:vpn'
  | 'net:proxy'
  | 'net:nat'
  | 'net:rack'
  | 'net:datacenter'
  | 'net:cluster'
  | 'net:cdn-pop'
  | 'net:wifi-ap'
  | 'net:segment'
  | 'net:packet'
  | 'net:wan'
  | 'net:vlan'
  | 'net:peering'
  | 'net:bgp'
  | 'net:private-link'
  | 'net:internet'
  | 'net:tablet';

/**
 * Full icon variant union — all valid SVG icon overlays for DiagramNode.
 * Resolved to public asset URLs by resolveIconUrl() in iconRegistry.ts.
 * `custom:${string}` is an escape hatch for custom resolver integrations.
 * By default, `custom:*` has no built-in asset mapping and resolves to undefined.
 */
export type DiagramIconVariant =
  | FlowIconShape
  | UiShape
  | TechShape
  | SecurityShape
  | DataShape
  | AwsShape
  | GcpShape
  | AzureShape
  | NetworkShape
  | `custom:${string}`;
