import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { getNodeHandler, registerNode } from '../registry';
import type { CompileApi, CompileHelpers, NodeHandler } from '../sceneDslTypes';
import type {
  InputActionMap,
  InputActionSpec,
  InputActionType,
  InputControllerScope,
  InputKeyMap,
  InputPinchMap,
  InputPointerMap,
  InputWheelMap,
  ModifierKey,
  MouseButton,
  SceneInputControllerSpec,
} from '../../input/types';

const INPUT_CONTROLLER_WIDGET_ID = '__input_controller';

export type InputControllerProps = {
  id?: string;
  scope?: InputControllerScope;
  children?: ReactNode;
};

export type ActionProps = {
  id: string;
  type: InputActionType;
  cameraId?: string;
  canvasId?: string;
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  /** Target ViewLayout ID for carousel actions. */
  layoutId?: string;
  /** Number of slides to advance per carousel step. Default: 1. */
  stepSlides?: number;
  children?: ReactNode;
};

export type PointerMapProps = {
  /**
   * The pointer event type to map to this action.
   * @default 'drag'
   */
  event?: 'drag' | 'click';
  /** @deprecated Use event=\"drag\" instead. */
  drag?: boolean;
  /** @deprecated Use event=\"click\" instead. */
  click?: boolean;
  button?: MouseButton;
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  lockAxis?: 'sticky' | 'free';
  lockThreshold?: number;
};

export type WheelMapProps = {
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  lockAxis?: 'sticky' | 'free';
};

export type PinchMapProps = {
  direction?: 'in' | 'out' | 'both';
  modifiers?: ModifierKey[];
  threshold?: number;
};

export type KeyMapProps = {
  /**
   * Canonical keyboard key prop, mapped to KeyboardEvent.key.
   */
  keyName?: string;
  /**
   * @deprecated React's key prop is reserved. Use keyName instead.
   */
  key?: string;
  modifiers?: ModifierKey[];
};

export const InputController = (_props: InputControllerProps) => null;
InputController.displayName = 'InputController';

export const Action = (_props: ActionProps) => null;
Action.displayName = 'Action';

export const PointerMap = (_props: PointerMapProps) => null;
PointerMap.displayName = 'PointerMap';

export const WheelMap = (_props: WheelMapProps) => null;
WheelMap.displayName = 'WheelMap';

export const PinchMap = (_props: PinchMapProps) => null;
PinchMap.displayName = 'PinchMap';

export const KeyMap = (_props: KeyMapProps) => null;
KeyMap.displayName = 'KeyMap';

const parseActionMap = (node: ReactElement, helpers: CompileHelpers, api: CompileApi): InputActionMap | null => {
  if (node.type === PointerMap) {
    const props = helpers.resolveObjectValues(node.props as PointerMapProps & Record<string, unknown>, api.context);
    let eventType: 'drag' | 'click' = 'drag';
    if (typeof props.event === 'string') {
      eventType = props.event;
    } else if (props.click === true || props.drag === true) {
      console.warn(
        '[BrewSite] <PointerMap drag> and <PointerMap click> are deprecated. ' +
        'Use <PointerMap event=\"drag\"> or <PointerMap event=\"click\"> instead.',
      );
      eventType = props.click === true ? 'click' : 'drag';
    }
    const map: InputPointerMap = {
      kind: 'pointer',
      event: eventType,
      button: props.button,
      modifiers: props.modifiers,
      axis: props.axis,
      lockAxis: props.lockAxis,
      lockThreshold: props.lockThreshold,
    };
    return map;
  }

  if (node.type === WheelMap) {
    const props = helpers.resolveObjectValues(node.props as WheelMapProps & Record<string, unknown>, api.context);
    const map: InputWheelMap = {
      kind: 'wheel',
      modifiers: props.modifiers,
      axis: props.axis,
      lockAxis: props.lockAxis,
    };
    return map;
  }

  if (node.type === KeyMap) {
    const props = helpers.resolveObjectValues(node.props as KeyMapProps & Record<string, unknown>, api.context);
    const reactKey = typeof node.key === 'string'
      ? node.key.replace(/^\.\$/, '')
      : null;
    const usingKeyNameProp = typeof props.keyName === 'string' && props.keyName.length > 0;
    const usingKeyPropFallback = !usingKeyNameProp && typeof reactKey === 'string' && reactKey.length > 0;
    if (usingKeyPropFallback) {
      console.warn(
        `[BrewSite] <KeyMap key=\"${reactKey}\"> uses React's reserved \"key\" prop as a fallback. ` +
        `Use <KeyMap keyName=\"${reactKey}\"> instead.`,
      );
    }
    const resolvedKey =
      (usingKeyNameProp ? props.keyName : undefined) ??
      (typeof props.key === 'string' && props.key.length > 0 ? props.key : undefined) ??
      (reactKey && reactKey.length > 0 ? reactKey : undefined);
    if (!resolvedKey) {
      throw new Error('<KeyMap> requires a non-empty "keyName" prop.');
    }
    const map: InputKeyMap = {
      kind: 'key',
      key: resolvedKey,
      modifiers: props.modifiers,
    };
    return map;
  }

  if (node.type === PinchMap) {
    const props = helpers.resolveObjectValues(node.props as PinchMapProps & Record<string, unknown>, api.context);
    const map: InputPinchMap = {
      kind: 'pinch',
      direction: props.direction ?? 'both',
      modifiers: props.modifiers,
      threshold: props.threshold,
    };
    return map;
  }

  return null;
};

const parseAction = (node: ReactElement, helpers: CompileHelpers, api: CompileApi): InputActionSpec => {
  const props = helpers.resolveObjectValues(node.props as ActionProps & Record<string, unknown>, api.context);
  if (typeof props.id !== 'string' || props.id.length === 0) {
    throw new Error('<Action> requires a non-empty "id" prop.');
  }
  if (typeof props.type !== 'string') {
    throw new Error('<Action> requires a valid "type" prop.');
  }

  const maps: InputActionMap[] = [];
  for (const child of helpers.collectChildren(node)) {
    if (!isValidElement(child)) continue;
    const map = parseActionMap(child as ReactElement, helpers, api);
    if (map) maps.push(map);
  }
  if (maps.length === 0) {
    throw new Error(`<Action id="${props.id}"> must include at least one mapping (<PointerMap>, <WheelMap>, <PinchMap>, or <KeyMap>).`);
  }

  return {
    id: props.id,
    type: props.type,
    cameraId: props.cameraId,
    canvasId: props.canvasId,
    focusCenter: props.focusCenter,
    speed: props.speed,
    stepScenes: props.stepScenes,
    layoutId: props.layoutId,
    stepSlides: props.stepSlides,
    maps,
  };
};

const inputControllerHandler: NodeHandler = (node, api, helpers) => {
  if (api.state.widgets[INPUT_CONTROLLER_WIDGET_ID] !== undefined) {
    throw new Error('Only one <InputController> is allowed per <Scene>.');
  }
  const props = helpers.resolveObjectValues(node.props as InputControllerProps & Record<string, unknown>, api.context);
  const actions: InputActionSpec[] = [];
  const actionIds = new Set<string>();

  for (const child of helpers.collectChildren(node)) {
    if (!isValidElement(child)) continue;
    const childEl = child as ReactElement;
    if (childEl.type !== Action) continue;
    const action = parseAction(childEl, helpers, api);
    if (actionIds.has(action.id)) {
      throw new Error(`<InputController> contains duplicate Action id "${action.id}".`);
    }
    actionIds.add(action.id);
    actions.push(action);
  }

  const spec: SceneInputControllerSpec = {
    id: typeof props.id === 'string' && props.id.length > 0 ? props.id : 'main',
    scope: props.scope ?? 'canvas',
    actions,
  };
  api.setWidgetState(INPUT_CONTROLLER_WIDGET_ID, spec);
};

const childOnlyHandler = (display: string): NodeHandler => () => {
  throw new Error(`<${display}> must be nested inside <InputController>.`);
};

export const ensureInputControllerRegistry = (): void => {
  if (!getNodeHandler(InputController)) registerNode(InputController, inputControllerHandler);
  if (!getNodeHandler(Action)) registerNode(Action, childOnlyHandler('Action'));
  if (!getNodeHandler(PointerMap)) registerNode(PointerMap, childOnlyHandler('PointerMap'));
  if (!getNodeHandler(WheelMap)) registerNode(WheelMap, childOnlyHandler('WheelMap'));
  if (!getNodeHandler(PinchMap)) registerNode(PinchMap, childOnlyHandler('PinchMap'));
  if (!getNodeHandler(KeyMap)) registerNode(KeyMap, childOnlyHandler('KeyMap'));
};

// NOTE: Module-scope auto-registration removed.
// registerCoreHandlers() in coreHandlers.ts calls ensureInputControllerRegistry().
