// Shared color interpolation utilities for chart renderers.

import { interpolateViridis, interpolatePlasma, interpolateBlues, interpolateReds } from 'd3-scale-chromatic';

/** Returns a d3 color interpolator function for the named palette. */
export function getInterpolator(name: 'blues' | 'reds' | 'viridis' | 'plasma' | undefined): (t: number) => string {
  switch (name) {
    case 'blues': return interpolateBlues;
    case 'reds': return interpolateReds;
    case 'plasma': return interpolatePlasma;
    case 'viridis':
    default:
      return interpolateViridis;
  }
}
