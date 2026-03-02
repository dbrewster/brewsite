import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import type { WidgetPlugin } from '@brewsite/core';
import { NeonSignWidget } from './widgets/neon-sign';
import { DiagramCanvasWidget, compileCanvas } from '@brewsite/diagram';

/**
 * Creates a DiagramCanvasWidget with a minimal empty default state.
 * The runtime will replace this with compiled state from the scene track on the first tick.
 */
const makeCanvas = (id: string): DiagramCanvasWidget =>
  new DiagramCanvasWidget(id, compileCanvas({ id }, [], []));

/**
 * Returns the WidgetPlugin array for the website engine.
 * Pass to EngineProvider's `plugins` prop.
 */
export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    {
      createWidgets: () => [
        new NeonSignWidget(),
        // Diagram canvas widgets — one per unique DiagramCanvas id used across all website scenes.
        makeCanvas('presentation-flow'),  // scene_01_core_intro + scene_02_core_baked
        makeCanvas('simple-tech-stack'),   // scene_01_simple_diagram
        makeCanvas('system-canvas'),       // scene_02_arch_overview + scene_03_arch_detail
        makeCanvas('full-diagram'),        // scene_02_combined
      ],
      registerHandlers: () => {},
    },
  ];
}
