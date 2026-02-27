import { describe, it, expect } from 'vitest';
import { Label, Labels } from '../dsl';
import { getNodeHandler } from '../../compiler/registry';

describe('labels DSL handlers', () => {
  it('registers handlers that throw when used at top-level', () => {
    const labelHandler = getNodeHandler(Label);
    const labelsHandler = getNodeHandler(Labels);
    expect(labelHandler).toBeDefined();
    expect(labelsHandler).toBeDefined();

    expect(() => labelHandler?.({ props: {} } as never, {} as never, {} as never))
      .toThrow('<Label> must be nested under <BodyPart> or <Subpart>.');
    expect(() => labelsHandler?.({ props: {} } as never, {} as never, {} as never))
      .toThrow('<Labels> is not supported. Use <Label> under <BodyPart> or <Subpart>.');
  });

  it('returns null for Label and Labels components', () => {
    expect(Label({ id: 'l1', text: 'Label', targetPartId: 'head' })).toBeNull();
    expect(Labels({ children: null })).toBeNull();
  });
});
