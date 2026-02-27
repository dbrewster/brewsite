import { describe, it, expect } from 'vitest';
import { shapeRequiresIcon } from '../shapes/shapeVariants';

describe('shapeRequiresIcon', () => {
  // ─── Existing cloud/flow namespaces ──────────────────────────────────────
  it('returns true for aws:ec2', () => {
    expect(shapeRequiresIcon('aws:ec2')).toBe(true);
  });

  it('returns true for gcp:cloud-run', () => {
    expect(shapeRequiresIcon('gcp:cloud-run')).toBe(true);
  });

  it('returns true for azure:app-service', () => {
    expect(shapeRequiresIcon('azure:app-service')).toBe(true);
  });

  it('returns true for flow:cloud', () => {
    expect(shapeRequiresIcon('flow:cloud')).toBe(true);
  });

  it('returns false for flow:rect', () => {
    expect(shapeRequiresIcon('flow:rect')).toBe(false);
  });

  it('returns false for flow:diamond', () => {
    expect(shapeRequiresIcon('flow:diamond')).toBe(false);
  });

  it('returns false for flow:cylinder', () => {
    expect(shapeRequiresIcon('flow:cylinder')).toBe(false);
  });

  // ─── New namespaces ───────────────────────────────────────────────────────
  it('returns true for ui:server', () => {
    expect(shapeRequiresIcon('ui:server')).toBe(true);
  });

  it('returns true for tech:docker', () => {
    expect(shapeRequiresIcon('tech:docker')).toBe(true);
  });

  it('returns true for security:shield', () => {
    expect(shapeRequiresIcon('security:shield')).toBe(true);
  });

  it('returns true for data:pipeline', () => {
    expect(shapeRequiresIcon('data:pipeline')).toBe(true);
  });

  it('returns true for net:router', () => {
    expect(shapeRequiresIcon('net:router')).toBe(true);
  });

  it('returns false for flow:hexagon', () => {
    expect(shapeRequiresIcon('flow:hexagon')).toBe(false);
  });

  it('returns false for flow:parallelogram', () => {
    expect(shapeRequiresIcon('flow:parallelogram')).toBe(false);
  });
});
