import { describe, it, expect } from 'vitest';
import { shapeRequiresIcon } from '../shapes/shapeVariants';

describe('shapeRequiresIcon', () => {
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
});
