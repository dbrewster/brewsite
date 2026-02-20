import {describe, expect, it} from 'vitest';
import {MockParticleSystem} from '../../../components/robot/particleSystem/MockParticleSystem';
import {MockNode} from '../mocks/MockWorld';

describe('MockParticleSystem', () => {
  it('tracks latest props from world updates', () => {
    const system = new MockParticleSystem();
    const node = new MockNode('Particles');
    const props = { enabled: true, opacity: 0.4, color: '#ffcc00', count: 12 };

    system.mount();
    system.updateFromWorld(node, props);

    expect(system.mounted).toBe(true);
    expect(system.lastNode?.name).toBe('Particles');
    expect(system.lastProps?.opacity).toBe(0.4);
    expect(system.lastProps?.color).toBe('#ffcc00');
    expect(system.lastProps?.count).toBe(12);
  });
});
