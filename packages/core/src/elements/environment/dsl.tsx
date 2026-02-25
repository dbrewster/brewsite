/**
 * Environment element DSL components.
 */

import type * as React from 'react';

export type EnvironmentProps = {
  enabled?: boolean;
  intensity?: number;
  children?: React.ReactNode;
};

export const Environment = (_props: EnvironmentProps) => null;

Environment.displayName = 'Environment';

export type EnvironmentHdriProps = {
  url: string;
  background?: boolean;
};

export const EnvironmentHdri = (_props: EnvironmentHdriProps) => null;
EnvironmentHdri.displayName = 'EnvironmentHdri';

export type EnvironmentExrProps = {
  url: string;
  background?: boolean;
};

export const EnvironmentExr = (_props: EnvironmentExrProps) => null;
EnvironmentExr.displayName = 'EnvironmentExr';

export type EnvironmentCubeProps = {
  urls: [string, string, string, string, string, string];
  background?: boolean;
};

export const EnvironmentCube = (_props: EnvironmentCubeProps) => null;
EnvironmentCube.displayName = 'EnvironmentCube';
