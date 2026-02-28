import { describe, it, expect } from 'vitest';
import { DEFAULT_NODE_SHAPE } from '../shapes/shapeVariants';
import type { DiagramNodeShape } from '../shapes/shapeVariants';
import { resolveIconUrl } from '../shapes/iconRegistry';

// ─── DiagramNodeShape ─────────────────────────────────────────────────────────

describe('DiagramNodeShape', () => {
  it('DEFAULT_NODE_SHAPE is rectangle', () => {
    expect(DEFAULT_NODE_SHAPE).toBe('rectangle');
  });

  it('all 15 polygon and special shape values are valid DiagramNodeShape members', () => {
    // Compile-time type check: this array must be assignable to DiagramNodeShape[]
    const allShapes = [
      'circle',
      'triangle',
      'square',
      'rectangle',
      'pentagon',
      'hexagon',
      'heptagon',
      'octagon',
      'nonagon',
      'decagon',
      'diamond',
      'oval',
      'cloud',
      'document',
      'parallelogram',
    ] satisfies DiagramNodeShape[];

    expect(allShapes).toHaveLength(15);
  });
});

// ─── resolveIconUrl ───────────────────────────────────────────────────────────

describe('resolveIconUrl', () => {
  it('returns undefined for undefined input', () => {
    expect(resolveIconUrl(undefined)).toBeUndefined();
  });

  it('resolves ui: namespace to correct path', () => {
    const url = resolveIconUrl('ui:server');
    expect(url).toBeDefined();
    expect(url).toContain('/ui/server.svg');
  });

  it('resolves ui:wrench-screwdriver to correct path', () => {
    const url = resolveIconUrl('ui:wrench-screwdriver');
    expect(url).toBeDefined();
    expect(url).toContain('/ui/wrench-screwdriver.svg');
  });

  it('resolves aws: namespace to correct path', () => {
    const url = resolveIconUrl('aws:lambda');
    expect(url).toBeDefined();
    expect(url).toContain('/aws/lambda.svg');
  });

  it('resolves aws:cloudfront to correct path', () => {
    const url = resolveIconUrl('aws:cloudfront');
    expect(url).toBeDefined();
    expect(url).toContain('/aws/cloudfront.svg');
  });

  it('resolves gcp: namespace to correct path', () => {
    const url = resolveIconUrl('gcp:bigquery');
    expect(url).toBeDefined();
    expect(url).toContain('/gcp/bigquery.svg');
  });

  it('resolves azure: namespace to correct path', () => {
    const url = resolveIconUrl('azure:functions');
    expect(url).toBeDefined();
    expect(url).toContain('/azure/functions.svg');
  });

  it('resolves tech: namespace to correct path', () => {
    const url = resolveIconUrl('tech:docker');
    expect(url).toBeDefined();
    expect(url).toContain('/tech/docker.svg');
  });

  it('resolves security: namespace to correct path', () => {
    const url = resolveIconUrl('security:shield');
    expect(url).toBeDefined();
    expect(url).toContain('/security/shield.svg');
  });

  it('resolves data: namespace to correct path', () => {
    const url = resolveIconUrl('data:pipeline');
    expect(url).toBeDefined();
    expect(url).toContain('/data/pipeline.svg');
  });

  it('resolves net: namespace to correct path', () => {
    const url = resolveIconUrl('net:router');
    expect(url).toBeDefined();
    expect(url).toContain('/net/router.svg');
  });

  it('resolves flow:actor to correct path', () => {
    const url = resolveIconUrl('flow:actor');
    expect(url).toBeDefined();
    expect(url).toContain('/flow/actor.svg');
  });

  it('resolves flow:queue to correct path', () => {
    const url = resolveIconUrl('flow:queue');
    expect(url).toBeDefined();
    expect(url).toContain('/flow/queue.svg');
  });

  it('returns undefined for custom: variants with no registered asset', () => {
    // custom: strings that don't match any namespace fall through to FLOW_ICON_MAP
    // and return undefined since they're not listed there
    const url = resolveIconUrl('custom:unknown-thing');
    expect(url).toBeUndefined();
  });
});
