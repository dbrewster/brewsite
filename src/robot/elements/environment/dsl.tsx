import type {ReactElement} from 'react';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi, CompileHelpers} from '../../runtime/compiler/sceneDslTypes';

export type EnvironmentProps = {
  enabled?: boolean;
  url?: string;
  preset?: 'room';
  intensity?: number;
};

export const Environment = (_props: EnvironmentProps) => null;

Environment.displayName = 'Environment';

registerNode(Environment, (node: ReactElement, api: CompileApi, _helper?: CompileHelpers) => {
  const props = node.props as EnvironmentProps;
  api.state.environment = {
    ...api.state.environment,
    enabled: props.enabled ?? api.state.environment.enabled,
    url: props.url ?? api.state.environment.url,
    preset: props.preset ?? api.state.environment.preset,
    intensity: props.intensity ?? api.state.environment.intensity,
  };
});
