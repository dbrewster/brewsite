import type {ReactElement, ReactNode} from 'react';
import {registerNode} from '../registry';
import type {CompileApi, CompileHelpers} from '../sceneDslTypes';

export type SceneProps = {
  id?: string;
  index?: number;
  entryStart?: number;
  isLightScene?: boolean;
  children?: ReactNode;
};

export const Scene = (_props: SceneProps) => null;

registerNode(Scene, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const props = node.props as SceneProps;
  api.setSceneMeta({ id: props.id, isLightScene: props.isLightScene });
  helper.compileChildren(node, api);
});
