import { describe, it, expect } from 'vitest';
import { Background } from '../primitives/Background';
import { Environment } from '../primitives/Environment';
import { Floor } from '../primitives/Floor';
import { Lighting } from '../primitives/Lighting';
import { Model } from '../primitives/Model';

describe('compiler primitives re-exports', () => {
  it('re-exports DSL components', () => {
    expect(typeof Background).toBe('function');
    expect(typeof Environment).toBe('function');
    expect(typeof Floor).toBe('function');
    expect(typeof Lighting).toBe('function');
    expect(typeof Model).toBe('function');
  });
});
