// useThemeCss — sets data-family + data-polarity attributes on <html> for CSS variable resolution.

import { useEffect } from 'react';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';

/**
 * Sets `data-family` and `data-polarity` attributes on `<html>`,
 * which drives all CSS variable resolution in the examples app.
 */
export function useThemeCss(family: ThemeFamily, polarity: ThemePolarity): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-family', family);
    root.setAttribute('data-polarity', polarity);
    return () => {
      root.removeAttribute('data-family');
      root.removeAttribute('data-polarity');
    };
  }, [family, polarity]);
}
