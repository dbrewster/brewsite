import type {ReactElement} from 'react';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi} from '../../runtime/compiler/sceneDslTypes';

export type FloorProps = {
  enabled?: boolean;
  textureUrl?: string;
};

export const Floor = (_props: FloorProps) => null;

Floor.displayName = 'Floor';

registerNode(Floor, (node: ReactElement, api: CompileApi) => {
  const props = node.props as FloorProps;
  api.state.floor = {
    ...api.state.floor,
    enabled: props.enabled ?? api.state.floor.enabled,
    textureUrl: props.textureUrl ?? api.state.floor.textureUrl,
  };
});
