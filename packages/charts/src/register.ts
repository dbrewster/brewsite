/**
 * Called by chartPlugin().registerHandlers().
 * Guard handlers fire if chart DSL child components appear outside <Chart>
 * when the compiler processes a scene.
 *
 * Do NOT call this directly — chartPlugin() handles registration.
 */
import { registerChartHandlers } from './compiler/handlers';

registerChartHandlers();
