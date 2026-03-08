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

export type EnvironmentHdriProps = {
  url: string;
  /**
   * When true, uses the HDRI both for lighting (`scene.environment`) and as
   * the visible scene background (`scene.background`).
   */
  background?: boolean;
};

export type EnvironmentExrProps = {
  url: string;
  /**
   * When true, uses the EXR both for lighting (`scene.environment`) and as
   * the visible scene background (`scene.background`).
   */
  background?: boolean;
};

export type EnvironmentCubeProps = {
  urls: [string, string, string, string, string, string];
  /**
   * When true, uses the cube texture both for lighting (`scene.environment`)
   * and as the visible scene background (`scene.background`).
   */
  background?: boolean;
};


