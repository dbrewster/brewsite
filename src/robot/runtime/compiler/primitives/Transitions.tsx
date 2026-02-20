import type {ReactElement, ReactNode} from 'react';
import {isValidElement} from 'react';
import {registerNode} from '../registry';
import type {CompileApi, CompileHelpers} from '../sceneDslTypes';
import {createAutoTransitionTransition} from '../sceneTransitions';

export type TransitionsProps = {
  children?: ReactNode;
};

export type AutoTransitionProps = {
  exitStart?: number | ((context: unknown) => number);
  exitEnd?: number | ((context: unknown) => number);
  enterStart?: number | ((context: unknown) => number);
  enterEnd?: number | ((context: unknown) => number);
  fade?: boolean;
  move?: boolean;
  scope?: 'active' | 'persist';
};

export const Transitions = (_props: TransitionsProps) => null;
export const AutoTransition = (_props: AutoTransitionProps) => null;

registerNode(AutoTransition, () => {});

registerNode(Transitions, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const children = helper.collectChildren(node);
  for (const child of children) {
    if (isValidElement(child)) {
      const childEl = child as ReactElement;
      if (childEl.type === AutoTransition) {
        const props = childEl.props as AutoTransitionProps;
        api.transitions.push(createAutoTransitionTransition(props, api.context));
      }
    }
  }
});
