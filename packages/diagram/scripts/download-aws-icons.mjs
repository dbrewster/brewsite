#!/usr/bin/env node
// packages/diagram/scripts/download-aws-icons.mjs
// Instructions for setting up AWS Architecture Icons in packages/diagram/public/assets/shapes/aws/
// Run once after cloning: node packages/diagram/scripts/download-aws-icons.mjs

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(__dirname, '../public/assets/shapes/aws');
const GCP_ICON_DIR = resolve(__dirname, '../public/assets/shapes/gcp');

const AWS_FILES = [
  'ec2.svg', 's3.svg', 'rds.svg', 'lambda.svg', 'alb.svg',
  'cloudfront.svg', 'vpc.svg', 'ecs.svg', 'eks.svg', 'sqs.svg',
  'sns.svg', 'api-gateway.svg', 'elasticache.svg', 'dynamodb.svg',
];

const GCP_FILES = [
  'compute-engine.svg', 'cloud-run.svg', 'bigquery.svg',
  'cloud-storage.svg', 'pubsub.svg',
];

const missing = {
  aws: AWS_FILES.filter(f => !existsSync(resolve(ICON_DIR, f))),
  gcp: GCP_FILES.filter(f => !existsSync(resolve(GCP_ICON_DIR, f))),
};

if (missing.aws.length === 0 && missing.gcp.length === 0) {
  console.log('✅ All icon assets are present.\n');
  process.exit(0);
}

console.log(`
@brewsite/diagram — Icon Asset Setup Required
=============================================

AWS Architecture Icons must be downloaded manually (CAPTCHA-protected download):

  1. Visit:   https://aws.amazon.com/architecture/icons/
  2. Download the ZIP (look for "AWS Architecture Icon Pack")
  3. Extract and copy SVGs to:
       ${ICON_DIR}/
  4. Rename files to match iconRegistry.ts keys, e.g.:
       Arch_Amazon-EC2_64.svg       → ec2.svg
       Arch_Amazon-S3_64.svg        → s3.svg
       Arch_Amazon-RDS_64.svg       → rds.svg
       Arch_AWS-Lambda_64.svg       → lambda.svg
       (see src/elements/diagram/shapes/iconRegistry.ts for full mapping)

Google Cloud icons (Apache 2.0 — can be automated):

  Visit:   https://cloud.google.com/icons
  Copy SVGs to: ${GCP_ICON_DIR}/

Missing AWS icons (${missing.aws.length}):
  ${missing.aws.join('\n  ')}
${missing.gcp.length > 0 ? `\nMissing GCP icons (${missing.gcp.length}):\n  ${missing.gcp.join('\n  ')}` : ''}

Shapes that use these icons will fall back to a plain box geometry until the SVGs
are present. No crash will occur — just a console.warn from render.ts.
`);
