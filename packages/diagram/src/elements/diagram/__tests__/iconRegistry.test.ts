import { describe, it, expect } from 'vitest';
import { resolveIconUrl } from '../shapes/iconRegistry';

describe('resolveIconUrl', () => {
  it('returns correct path for aws:ec2', () => {
    expect(resolveIconUrl('aws:ec2')).toBe('/assets/shapes/aws/ec2.svg');
  });

  it('returns correct path for flow:cloud', () => {
    expect(resolveIconUrl('flow:cloud')).toBe('/assets/shapes/flow/cloud.svg');
  });

  it('returns undefined for flow:rect (geometry-only shape)', () => {
    expect(resolveIconUrl('flow:rect')).toBeUndefined();
  });

  it('returns a path for azure:app-service (open union — dynamic construction)', () => {
    expect(resolveIconUrl('azure:app-service')).toBe('/assets/shapes/azure/app-service.svg');
  });

  it('returns undefined for custom:my-shape (unknown custom shape)', () => {
    expect(resolveIconUrl('custom:my-shape')).toBeUndefined();
  });
});
