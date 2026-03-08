import { describe, it, expect, beforeEach } from 'vitest';
import { Label, Labels } from '../../elements/model/ModelWidget';
import { getNodeHandler } from '@brewsite/core/compiler/registry';
import { clearRegistry } from '@brewsite/core/testing';
import { registerModelHandlers, resetModelHandlerRegistrationForTesting } from '../../handlers';

describe('labels DSL handlers', () => {
  beforeEach(() => {
    clearRegistry();
    resetModelHandlerRegistrationForTesting();
  });

  it('registers handlers that throw when used at top-level', () => {
    registerModelHandlers();
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
