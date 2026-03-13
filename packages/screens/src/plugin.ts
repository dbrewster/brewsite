// screensPlugin — WidgetPlugin factory for @brewsite/screens.
// Lazy widget creation: no upfront ID enumeration required.
// All three element types are registered and auto-created on first DSL compile.

import type { ReactElement } from 'react';
import type { WidgetPlugin, WidgetRegistry, CompileApi, CompileHelpers } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import { Screen, ScreenWidget } from './elements/screen/widget';
import { ImagePanel, ImagePanelWidget } from './elements/image-panel/widget';
import { MediaScreen, MediaScreenWidget } from './elements/media-screen/widget';
import { compileScreen } from './elements/screen/compile';
import { compileImagePanel } from './elements/image-panel/compile';
import { compileMediaScreen } from './elements/media-screen/compile';
import type { ScreenDSL } from './elements/screen/types';
import type { ImagePanelDSL } from './elements/image-panel/types';
import type { MediaScreenDSL } from './elements/media-screen/types';

/**
 * WidgetPlugin for @brewsite/screens.
 *
 * Registers Screen, MediaScreen, and ImagePanel DSL handlers.
 * Widget instances are created lazily on first compile encounter — no ID
 * enumeration needed. Just add screensPlugin() to your plugins array.
 *
 * @example
 * plugins={[corePlugin(), screensPlugin()]}
 *
 * // In scene DSL:
 * <Screen id="s1" src="https://example.com" x={0.5} y={0.5} />
 * <MediaScreen id="s2" src="/demo.mp4" x={0.5} y={0.5} />
 * <ImagePanel id="p1" src="/mockup.png" x={0.5} y={0.5} rotation={[0, 0.2, 0]} />
 */
export function screensPlugin(): WidgetPlugin {
  return {
    createWidgets(): [] {
      // Widgets are created lazily inside configureRegistry node handlers.
      return [];
    },

    registerHandlers(): void {
      // No-op: handlers are registered with registry closure in configureRegistry.
      // registerNode is last-write-wins (Map.set) — configureRegistry calls take precedence.
    },

    configureRegistry(registry: WidgetRegistry): void {
      registerNode(Screen, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as ScreenDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new ScreenWidget(dsl.id, compileScreen({ id: dsl.id, src: '', enabled: false })));
        }
        api.setWidgetState(dsl.id, compileScreen(dsl));
      });

      registerNode(MediaScreen, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as MediaScreenDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new MediaScreenWidget(dsl.id, compileMediaScreen({ id: dsl.id, enabled: false })));
        }
        api.setWidgetState(dsl.id, compileMediaScreen(dsl));
      });

      registerNode(ImagePanel, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as ImagePanelDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new ImagePanelWidget(dsl.id, compileImagePanel({ id: dsl.id, src: '', enabled: false })));
        }
        api.setWidgetState(dsl.id, compileImagePanel(dsl));
      });
    },
  };
}
