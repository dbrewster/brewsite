// Auto-registers @brewsite/charts DSL handlers at module-load time.
// Imported by src/index.ts — runs once when @brewsite/charts is first imported.
import { registerChartHandlers } from './compiler/handlers';

registerChartHandlers();
