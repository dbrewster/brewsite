import type {ReactElement} from 'react';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi} from '../../runtime/compiler/sceneDslTypes';

export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  position?: [number, number, number];
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
};

export const Background = (_props: BackgroundProps) => null;

Background.displayName = 'Background';

registerNode(Background, (node: ReactElement, api: CompileApi) => {
  const props = node.props as BackgroundProps;
  api.state.background = {
    ...api.state.background,
    imageUrl: props.imageUrl ?? api.state.background.imageUrl,
    opacity: props.opacity ?? api.state.background.opacity,
    position: props.position ?? api.state.background.position,
    cssPosition: props.cssPosition ?? api.state.background.cssPosition,
    cssSize: props.cssSize ?? api.state.background.cssSize,
    cssRepeat: props.cssRepeat ?? api.state.background.cssRepeat,
  };
});
