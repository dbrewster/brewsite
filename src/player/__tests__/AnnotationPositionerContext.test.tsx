// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { AnnotationPositionerContext, useAnnotationPositioner } from '../AnnotationPositionerContext';
import { AnnotationPositioner } from '../AnnotationPositioner';

const Consumer = () => {
  const ctx = useAnnotationPositioner();
  return <div>{ctx instanceof AnnotationPositioner ? 'ok' : 'bad'}</div>;
};

describe('AnnotationPositionerContext', () => {
  it('throws outside provider', () => {
    expect(() => render(<Consumer />)).toThrow('[useAnnotationPositioner]');
  });

  it('returns context value inside provider', () => {
    const positioner = new AnnotationPositioner();
    const { getByText } = render(
      <AnnotationPositionerContext.Provider value={positioner}>
        <Consumer />
      </AnnotationPositionerContext.Provider>,
    );
    expect(getByText('ok')).toBeDefined();
  });
});
