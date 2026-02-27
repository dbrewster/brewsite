import { describe, it, expect } from 'vitest';
import { resolveIconUrl } from '../shapes/iconRegistry';

describe('resolveIconUrl', () => {
  // ─── Legacy / existing namespaces ────────────────────────────────────────
  it('returns correct path for aws:ec2', () => {
    expect(resolveIconUrl('aws:ec2')).toBe('/assets/shapes/aws/ec2.svg');
  });

  it('returns correct path for flow:cloud', () => {
    expect(resolveIconUrl('flow:cloud')).toBe('/assets/shapes/flow/cloud.svg');
  });

  it('returns undefined for flow:rect (geometry-only shape)', () => {
    expect(resolveIconUrl('flow:rect')).toBeUndefined();
  });

  it('returns a path for azure:app-service (closed union with explicit map)', () => {
    expect(resolveIconUrl('azure:app-service')).toBe('/assets/shapes/azure/app-service.svg');
  });

  it('returns undefined for custom:my-shape (unknown custom shape)', () => {
    expect(resolveIconUrl('custom:my-shape')).toBeUndefined();
  });

  // ─── ui: namespace ────────────────────────────────────────────────────────
  it('returns correct path for ui:server', () => {
    expect(resolveIconUrl('ui:server')).toBe('/assets/shapes/ui/server.svg');
  });

  it('returns correct path for ui:cpu-chip', () => {
    expect(resolveIconUrl('ui:cpu-chip')).toBe('/assets/shapes/ui/cpu-chip.svg');
  });

  it('returns correct path for ui:shield-check', () => {
    expect(resolveIconUrl('ui:shield-check')).toBe('/assets/shapes/ui/shield-check.svg');
  });

  // ─── tech: namespace ──────────────────────────────────────────────────────
  it('returns correct path for tech:docker', () => {
    expect(resolveIconUrl('tech:docker')).toBe('/assets/shapes/tech/docker.svg');
  });

  it('returns correct path for tech:kubernetes', () => {
    expect(resolveIconUrl('tech:kubernetes')).toBe('/assets/shapes/tech/kubernetes.svg');
  });

  it('returns correct path for tech:nextjs', () => {
    expect(resolveIconUrl('tech:nextjs')).toBe('/assets/shapes/tech/nextjs.svg');
  });

  // ─── security: namespace ──────────────────────────────────────────────────
  it('returns correct path for security:shield', () => {
    expect(resolveIconUrl('security:shield')).toBe('/assets/shapes/security/shield.svg');
  });

  it('returns correct path for security:lock', () => {
    expect(resolveIconUrl('security:lock')).toBe('/assets/shapes/security/lock.svg');
  });

  // ─── data: namespace ──────────────────────────────────────────────────────
  it('returns correct path for data:pipeline', () => {
    expect(resolveIconUrl('data:pipeline')).toBe('/assets/shapes/data/pipeline.svg');
  });

  it('returns correct path for data:warehouse', () => {
    expect(resolveIconUrl('data:warehouse')).toBe('/assets/shapes/data/warehouse.svg');
  });

  // ─── net: namespace ───────────────────────────────────────────────────────
  it('returns correct path for net:router', () => {
    expect(resolveIconUrl('net:router')).toBe('/assets/shapes/net/router.svg');
  });

  it('returns correct path for net:cluster', () => {
    expect(resolveIconUrl('net:cluster')).toBe('/assets/shapes/net/cluster.svg');
  });

  // ─── expanded cloud namespaces ────────────────────────────────────────────
  it('returns correct path for aws:bedrock (new service)', () => {
    expect(resolveIconUrl('aws:bedrock')).toBe('/assets/shapes/aws/bedrock.svg');
  });

  it('returns correct path for gcp:vertex-ai (new service)', () => {
    expect(resolveIconUrl('gcp:vertex-ai')).toBe('/assets/shapes/gcp/vertex-ai.svg');
  });

  it('returns correct path for azure:cosmos-db', () => {
    expect(resolveIconUrl('azure:cosmos-db')).toBe('/assets/shapes/azure/cosmos-db.svg');
  });
});
