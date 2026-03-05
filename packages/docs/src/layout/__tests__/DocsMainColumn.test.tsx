import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { DocsMainColumn } from '../DocsMainColumn';

it('renders children', () => {
  const { getByTestId } = render(
    <DocsMainColumn><div data-testid="child" /></DocsMainColumn>
  );
  expect(getByTestId('child')).not.toBeNull();
});

it('does not apply overflow-y: auto', () => {
  const { container } = render(<DocsMainColumn><div /></DocsMainColumn>);
  const el = container.firstElementChild as HTMLElement;
  expect(el.style.overflowY).not.toBe('auto');
  expect(el.style.overflowY).not.toBe('scroll');
});

it('does not apply height: 100vh', () => {
  const { container } = render(<DocsMainColumn><div /></DocsMainColumn>);
  const el = container.firstElementChild as HTMLElement;
  expect(el.style.height).toBe('');
});

it('forwards ref to the outer div', () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(<DocsMainColumn ref={ref}><div /></DocsMainColumn>);
  expect(ref.current).toBe(container.firstElementChild);
});
