// Factory for the built-in core WidgetPlugin.
// Provides all non-model core widgets, DSL handlers, and TextBox overlay support.

import React from 'react';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { registerCoreHandlers } from '../compiler/coreHandlers';
import { registerNode } from '../compiler/registry';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import { CameraWidget } from '../elements/camera/CameraWidget';
import { SceneMetaWidget } from './SceneMetaWidget';
import { TextBox } from '../elements/text-box/dsl';
import { TextBoxWidget } from '../elements/text-box/TextBoxWidget';
import { TextBoxChildrenContext } from './TextBoxChildrenContext';

export interface CorePluginOptions {
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
}

/**
 * Built-in WidgetPlugin for @brewsite/core.
 *
 * Provides: LightingWidget, BackgroundWidget, EnvironmentWidget, FloorWidget,
 * CameraWidget, SceneMetaWidget, TextBoxWidget support, and all core DSL
 * NodeHandlers (Scene, InputController, Action, ProgressManager, TextBox,
 * and related child components).
 *
 * Does NOT include model or label widgets — use modelPlugin() from
 * @brewsite/model for those.
 *
 * @example
 * <EngineProvider
 *   plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 * />
 */
export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  // Created once per plugin instance. Shared between all TextBoxWidget instances
  // and EngineOverlayHost via TextBoxChildrenContext. Stores React children that
  // cannot be serialized to VariableStore (which accepts JsonPrimitive only).
  const textBoxChildrenMap = new Map<string, React.ReactNode>();

  return {
    createWidgets: () => [
      new LightingWidget(),
      new BackgroundWidget(),
      new EnvironmentWidget(),
      new FloorWidget(),
      new CameraWidget(),
      new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
      // TextBoxWidgets are NOT pre-created here. They are created dynamically
      // by the configureRegistry NodeHandler when the compiler first encounters
      // each <TextBox id="...">.
    ],
    registerHandlers: () => {
      registerCoreHandlers();
      // No TextBox handler here — it is installed by configureRegistry below.
    },
    configureRegistry: (registry) => {
      // Always re-register the TextBox NodeHandler so the closure captures
      // the current registry. registerNode is a Map.set — calling it again
      // simply overwrites the previous entry with the updated closure.
      registerNode(TextBox, (node, api) => {
        const props = node.props as Record<string, unknown>;
        const widgetId = typeof props['id'] === 'string' ? props['id'] : undefined;
        if (!widgetId) {
          console.warn('[TextBox] DSL component requires a string "id" prop. Skipping.');
          return;
        }

        // Store React children at compile time — do NOT pass through the widget
        // state pipeline (SceneTrack serialization strips non-JSON-primitive values).
        const children = (props['children'] as React.ReactNode) ?? null;
        textBoxChildrenMap.set(widgetId, children);

        // Create the widget on first encounter of this id; reuse thereafter.
        let widget = registry.get(widgetId);
        if (!widget) {
          widget = new TextBoxWidget(widgetId, textBoxChildrenMap);
          registry.register(widget);
        }
        // Pass only serializable state — children are stored above, not in state.
        const textBoxWidget = widget as TextBoxWidget;
        const { children: _children, ...serializableProps } = props;
        api.setWidgetState(widgetId, {
          ...(textBoxWidget.defaultState as object),
          ...serializableProps,
        });
      });
    },
    wrapProvider: (innerContent) => (
      React.createElement(
        TextBoxChildrenContext.Provider,
        { value: textBoxChildrenMap },
        innerContent,
      )
    ),
  };
}
