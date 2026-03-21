// Tests for resolveTemplate — pure function, no mocks needed.

import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../resolveTemplate';
import type { SlideTemplate } from '../../types';

describe('resolveTemplate', () => {
  it('returns undefined when no template is provided', () => {
    expect(resolveTemplate()).toBeUndefined();
    expect(resolveTemplate(undefined)).toBeUndefined();
  });

  it('produces --slide-footer-height: 32px when footer is configured', () => {
    const template: SlideTemplate = {
      name: 'Test',
      master: {
        footer: { text: 'Acme Corp' },
      },
    };
    const result = resolveTemplate(template);
    expect(result).toBeDefined();
    expect(result!.cssVars['--slide-footer-height']).toBe('32px');
  });

  it('produces --slide-footer-height: 0px when no footer', () => {
    const template: SlideTemplate = { name: 'Test' };
    const result = resolveTemplate(template);
    expect(result).toBeDefined();
    expect(result!.cssVars['--slide-footer-height']).toBe('0px');
  });

  it('produces correct --slide-logo-size from logo config', () => {
    const template: SlideTemplate = {
      name: 'Test',
      master: {
        logo: { asset: 'logo', position: 'top-left', size: '64px' },
      },
    };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-logo-size']).toBe('64px');
  });

  it('defaults --slide-logo-size to 40px when logo has no size', () => {
    const template: SlideTemplate = {
      name: 'Test',
      master: {
        logo: { asset: 'logo', position: 'top-left' },
      },
    };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-logo-size']).toBe('40px');
  });

  it('produces --slide-logo-size: 0px when no logo', () => {
    const template: SlideTemplate = { name: 'Test' };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-logo-size']).toBe('0px');
  });

  it('produces --slide-watermark-opacity from watermark config', () => {
    const template: SlideTemplate = {
      name: 'Test',
      master: {
        watermark: { text: 'DRAFT', opacity: 0.1 },
      },
    };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-watermark-opacity']).toBe('0.1');
  });

  it('defaults --slide-watermark-opacity to 0.05 when no opacity specified', () => {
    const template: SlideTemplate = {
      name: 'Test',
      master: {
        watermark: { text: 'CONFIDENTIAL' },
      },
    };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-watermark-opacity']).toBe('0.05');
  });

  it('produces --slide-watermark-opacity: 0 when no watermark', () => {
    const template: SlideTemplate = { name: 'Test' };
    const result = resolveTemplate(template);
    expect(result!.cssVars['--slide-watermark-opacity']).toBe('0');
  });

  it('produces all-zero CSS vars when no master is configured', () => {
    const template: SlideTemplate = { name: 'Empty' };
    const result = resolveTemplate(template);
    expect(result).toBeDefined();
    expect(result!.cssVars['--slide-footer-height']).toBe('0px');
    expect(result!.cssVars['--slide-logo-size']).toBe('0px');
    expect(result!.cssVars['--slide-watermark-opacity']).toBe('0');
  });

  it('preserves the original template in the result', () => {
    const template: SlideTemplate = {
      name: 'Acme',
      brand: { logo: { src: '/logo.png', alt: 'Acme' } },
      master: { footer: { text: 'Acme Inc.' } },
    };
    const result = resolveTemplate(template);
    expect(result!.template).toBe(template);
  });
});
