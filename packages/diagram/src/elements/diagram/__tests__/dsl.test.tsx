import { describe, it, expect } from 'vitest';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  Enter,
  Exit,
} from '../dsl';

describe('diagram DSL components', () => {
  it('returns null for all DSL components', () => {
    expect(Diagram({ id: 'd1' })).toBeNull();
    expect(DiagramNode({ id: 'n1' })).toBeNull();
    expect(DiagramEdge({ from: 'a', to: 'b' })).toBeNull();
    expect(DiagramGroup({ id: 'g1', label: 'Group' })).toBeNull();
    expect(Exit({})).toBeNull();
    expect(Enter({})).toBeNull();
  });
});
