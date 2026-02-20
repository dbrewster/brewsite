/**
 * Environment element DSL components.
 */

export type EnvironmentProps = {
  enabled?: boolean;
  url?: string;
  preset?: 'room';
  intensity?: number;
};

export const Environment = (_props: EnvironmentProps) => null;

Environment.displayName = 'Environment';
