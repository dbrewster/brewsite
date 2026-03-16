// CarouselTray — DSL child component for ViewLayout carousel tray.

import type { CarouselScrubberStyle } from './types';

/**
 * Props for the <CarouselTray> DSL component.
 *
 * Place as a child of <ViewLayout kind="carousel"> to render a 3D tray base
 * underneath the carousel. Position and size are computed automatically from
 * the carousel's layout bounds and floor position.
 *
 * All visual settings can also be set at the theme level via
 * `SceneTheme.carouselTray`. DSL props override theme values.
 */
export type CarouselTrayProps = {
  /** Tray base color. Default: '#2C3E55'. */
  color?: string;
  /** Tray base opacity [0..1]. Default: 0.6. */
  opacity?: number;
  /** Accent color for tray highlights. Default: '#5090e0'. */
  accentColor?: string;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  depth?: number;
  /** Gap between tray bottom edge and floor in world units. Default: 0.02. */
  gap?: number;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness?: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness?: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
  /** Surface texture pattern. Default: 'brushed'. */
  surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  /** Surface texture intensity [0-1]. Default: 0.25. */
  surfaceIntensity?: number;
  /** URL to a custom normal map texture. Overrides surfacePattern when set. */
  surfaceMapUrl?: string;
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler, not rendered directly. */
export const CarouselTray = (_props: CarouselTrayProps): null => null;
CarouselTray.displayName = 'CarouselTray';

// Keep the old type for backward compatibility with the standalone element.
export type CarouselScrubberProps = {
  id: string;
  layoutId: string;
  showBase?: boolean;
  trayDepth?: number;
  gap?: number;
  style?: Partial<CarouselScrubberStyle>;
};
