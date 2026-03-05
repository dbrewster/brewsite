import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Section } from '../Section';

describe('Section', () => {
  it('renders a <section> element with correct id and data-section-id', () => {
    const { container } = render(<Section id="installation" title="Installation">content</Section>);
    const el = container.querySelector('section');
    expect(el).not.toBeNull();
    expect(el?.id).toBe('installation');
    expect(el?.getAttribute('data-section-id')).toBe('installation');
  });

  it('renders <h2> when title is provided', () => {
    const { container } = render(<Section id="foo" title="My Section">content</Section>);
    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('My Section');
  });

  it('does not render <h2> when title is omitted', () => {
    const { container } = render(<Section id="foo">content</Section>);
    expect(container.querySelector('h2')).toBeNull();
  });

  it('renders children inside the section element', () => {
    const { getByText } = render(<Section id="foo">Hello World</Section>);
    expect(getByText('Hello World')).not.toBeNull();
  });
});
