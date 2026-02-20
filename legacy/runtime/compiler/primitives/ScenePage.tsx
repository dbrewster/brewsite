import type { ReactElement, ReactNode } from 'react';
import { registerNode } from '../registry';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';

export type ScenePageProps = {
  id: string;
  children?: ReactNode;
};

export type ResourcesProps = {
  children?: ReactNode;
};

export type SceneGroupProps = {
  children?: ReactNode;
};

export type ModelDefinitionProps = {
  id: string;
  path: string;
  role: 'primary' | 'brain' | 'attachment' | 'unknown';
};

export type AnimationDefinitionProps = {
  id: string;
  path: string;
  clipName?: string;
};

export const ScenePage = (_props: ScenePageProps) => null;
export const Resources = (_props: ResourcesProps) => null;
export const SceneGroup = (_props: SceneGroupProps) => null;
export const ModelDefinition = (_props: ModelDefinitionProps) => null;
export const AnimationDefinition = (_props: AnimationDefinitionProps) => null;

// These are not used by the scene compiler directly; they are DSL containers.
// Register handlers to allow future page-level compilers to traverse children.
registerNode(ScenePage, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  helper.compileChildren(node, api);
});

registerNode(Resources, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  helper.compileChildren(node, api);
});

registerNode(SceneGroup, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  helper.compileChildren(node, api);
});

registerNode(ModelDefinition, () => {});
registerNode(AnimationDefinition, () => {});
