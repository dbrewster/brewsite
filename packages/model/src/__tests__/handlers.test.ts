import { describe, it, expect, beforeEach } from 'vitest';
import { registerModelHandlers, resetModelHandlerRegistrationForTesting } from '../handlers';
import { getNodeHandler } from '@brewsite/core/compiler/registry';
import { clearRegistry } from '@brewsite/core/testing';
import { Label } from '../labels/dsl';

beforeEach(() => {
  clearRegistry();
  resetModelHandlerRegistrationForTesting();
});

describe('registerModelHandlers', () => {
  it('registerModelHandlers() installs Label guard handler', () => {
    registerModelHandlers();
    const handler = getNodeHandler(Label);
    expect(handler).toBeDefined();
    // Handler must throw when invoked at top level:
    expect(() => handler!({} as any, {} as any, {} as any)).toThrow('<Label>');
  });

  it('registerModelHandlers() is idempotent', () => {
    registerModelHandlers();
    registerModelHandlers(); // second call must not throw or duplicate
    const handler = getNodeHandler(Label);
    expect(handler).toBeDefined();
  });

  it('registerModelHandlers() resetModelHandlerRegistrationForTesting() allows re-registration', () => {
    registerModelHandlers();
    resetModelHandlerRegistrationForTesting();
    clearRegistry();
    // After reset, should be able to register again
    expect(getNodeHandler(Label)).toBeUndefined();
    registerModelHandlers();
    expect(getNodeHandler(Label)).toBeDefined();
  });
});
