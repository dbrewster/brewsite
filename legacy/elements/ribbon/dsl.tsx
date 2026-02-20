import type {ReactElement, ReactNode} from 'react';
import {registerNode} from '../../runtime/compiler/registry';
import type {CompileApi, CompileHelpers} from '../../runtime/compiler/sceneDslTypes';
import type {RibbonConfig} from './types';

export type RibbonProps = {
  enabled?: boolean;
  config?: RibbonConfig | ((context: unknown) => RibbonConfig);
  children?: ReactNode;
};

export const Ribbon = (_props: RibbonProps) => null;

registerNode(Ribbon, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const props = node.props as RibbonProps;
  const ribbon = { ...api.state.ribbon };
  if (props.enabled !== undefined) ribbon.enabled = props.enabled;
  if (props.config) {
    ribbon.config = helper.resolveValue(props.config, api.context);
    if (props.enabled === undefined) {
      ribbon.enabled = true;
    }
  }
  api.setRibbon(ribbon);
});
