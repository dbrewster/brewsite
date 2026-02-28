/**
 * Environment element DSL components.
 */

import type * as React from 'react';

export type EnvironmentProps = {
  enabled?: boolean;
  intensity?: number;
  /**
   * Environment source child.
   * Exactly one of `<EnvironmentHdri>`, `<EnvironmentExr>`, or
   * `<EnvironmentCube>` should be provided when `enabled` is true.
   */
  children?: React.ReactNode;
};

/**
 * Environment lighting (IBL) element.
 *
 * Requires one source child to produce an environment map:
 * - `<EnvironmentHdri url="..." />`
 * - `<EnvironmentExr url="..." />`
 * - `<EnvironmentCube urls={[...]} />`
 */
export const Environment = (_props: EnvironmentProps) => null;

Environment.displayName = 'Environment';

export type EnvironmentHdriProps = {
  url: string;
  /**
   * When true, uses the HDRI both for lighting (`scene.environment`) and as
   * the visible scene background (`scene.background`).
   */
  background?: boolean;
};

export const EnvironmentHdri = (_props: EnvironmentHdriProps) => null;
EnvironmentHdri.displayName = 'EnvironmentHdri';

export type EnvironmentExrProps = {
  url: string;
  /**
   * When true, uses the EXR both for lighting (`scene.environment`) and as
   * the visible scene background (`scene.background`).
   */
  background?: boolean;
};

export const EnvironmentExr = (_props: EnvironmentExrProps) => null;
EnvironmentExr.displayName = 'EnvironmentExr';

export type EnvironmentCubeProps = {
  urls: [string, string, string, string, string, string];
  /**
   * When true, uses the cube texture both for lighting (`scene.environment`)
   * and as the visible scene background (`scene.background`).
   */
  background?: boolean;
};

export const EnvironmentCube = (_props: EnvironmentCubeProps) => null;
EnvironmentCube.displayName = 'EnvironmentCube';
